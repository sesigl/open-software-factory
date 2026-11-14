// The outbox's events to the JetStream stream "OSF", in order, on one connection; each publish waits until the stream
// stored the event (ADR 0085). And the foreman's run events through the durable consumer "intake", on a connection
// that waits for NATS and connects again (ADR 0071), so the server gets the run events of a time it was down. A run
// event that failed MAX_DELIVER times waits as a dead letter on "osf.dead.intake.>" until "intake resend" (ADR 0116).
import { AckPolicy, DeliverPolicy, type JetStreamManager, jetstream, jetstreamManager } from "@nats-io/jetstream";
import { connect, type NatsConnection } from "@nats-io/transport-node";

const STREAM = "OSF";
const CONSUMER = "intake";
const RETRY_MS = 2000;
/** A run event whose handling failed comes again after REDELIVER_MS, at most MAX_DELIVER times. */
const REDELIVER_MS = 2000;
const MAX_DELIVER = 5;
const DEAD = `osf.dead.${CONSUMER}.`;
const RESEND = `osf.resend.${CONSUMER}.`;

/** The NATS server, and the age after which the stream drops an event (OSF_STREAM_MAX_AGE), if one is set. */
export interface NatsAt {
  url: string;
  maxAgeMs?: number | undefined;
}

/**
 * Adds the stream on "osf.>". Adding it again with the same configuration changes nothing; a stream that another
 * module added with another age gets this one's, and keeps its own when this one has none (ADR 0116).
 */
async function streamOf(nats: NatsConnection, maxAgeMs: number | undefined): Promise<JetStreamManager> {
  const manager = await jetstreamManager(nats);
  const max_age = maxAgeMs ? maxAgeMs * 1_000_000 : 0;
  await manager.streams
    .add({ name: STREAM, subjects: ["osf.>"], max_age })
    .catch((failure: Error) =>
      maxAgeMs
        ? manager.streams.update(STREAM, { max_age })
        : manager.streams.info(STREAM).catch(() => Promise.reject(failure)),
    );
  return manager;
}

/** The subject a message came on first: a resent dead letter comes on RESEND and its first subject. */
const firstSubject = (subject: string) =>
  subject.startsWith(RESEND) ? `osf.${subject.slice(RESEND.length)}` : subject;

/** The number of dead letters of the consumer that wait in the stream. */
async function deadCount(manager: JetStreamManager): Promise<number> {
  const { state } = await manager.streams.info(STREAM, { subjects_filter: `${DEAD}>` });
  return Object.values(state.subjects ?? {}).reduce((sum, count) => sum + count, 0);
}

/**
 * Sends each dead letter of "intake" again, on RESEND, which the consumer reads, and removes it from the stream;
 * returns the first subjects of the events it sent.
 */
export async function resendDeadLetters(at: NatsAt): Promise<string[]> {
  const nats = await connect({ servers: at.url, timeout: 2000 });
  const resend = async () => {
    const manager = await streamOf(nats, at.maxAgeMs);
    const { state } = await manager.streams.info(STREAM, { subjects_filter: `${DEAD}>` });
    const sent: string[] = [];
    for (const subject of Object.keys(state.subjects ?? {}).sort()) {
      for (;;) {
        const dead = await manager.streams.getMessage(STREAM, { last_by_subj: subject }).catch(() => null);
        if (!dead) break;
        await jetstream(nats).publish(RESEND + subject.slice(DEAD.length), dead.data);
        await manager.streams.deleteMessage(STREAM, dead.seq);
        sent.push(`osf.${subject.slice(DEAD.length)}`);
      }
    }
    return sent;
  };
  return resend().finally(() => nats.close());
}

export async function publishToNats(at: NatsAt, events: { subject: string; event: unknown }[]): Promise<void> {
  const nats = await connect({ servers: at.url, timeout: 2000 });
  const sent = async () => {
    await streamOf(nats, at.maxAgeMs);
    const stream = jetstream(nats);
    for (const { subject, event } of events) await stream.publish(subject, JSON.stringify(event));
  };
  await sent().finally(() => nats.close());
}

/**
 * Calls `handle` with each message's JSON on the subjects, one message after the other, through the durable consumer
 * "intake". It tries to reach NATS every 2 seconds until it does, then reconnects on its own. A message is
 * acknowledged after `handle` resolved; a message that is not JSON, or that `handle` fails on, is a warning and comes
 * again, at most MAX_DELIVER times, then waits as a dead letter. Resolves after the first try, with `ping` (one round
 * trip to NATS, which waits while the connection is down and fails before the first connection), `deadLetters`, the
 * number of dead letters that wait, and `stop`, which stops listening.
 */
export async function subscribeToNats(
  at: NatsAt,
  subjects: string[],
  handle: (event: unknown) => Promise<void>,
  warn: (text: string) => void,
): Promise<{ ping(): Promise<void>; deadLetters(): Promise<number>; stop(): Promise<void> }> {
  let stopped = false;
  let nats: NatsConnection | undefined;
  let timer: NodeJS.Timeout | undefined;
  const listen = async (connection: NatsConnection) => {
    const manager = await streamOf(connection, at.maxAgeMs);
    const filter_subjects = [...subjects, `${RESEND}>`];
    // The consumer of an earlier version listens on fewer subjects; it then gets this version's (ADR 0113).
    await manager.consumers
      .add(STREAM, {
        durable_name: CONSUMER,
        filter_subjects,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        max_deliver: MAX_DELIVER,
      })
      .catch(() => manager.consumers.update(STREAM, CONSUMER, { filter_subjects }));
    const messages = await (await jetstream(connection).consumers.get(STREAM, CONSUMER)).consume();
    void (async () => {
      for await (const message of messages) {
        try {
          await handle(message.json());
          message.ack();
        } catch (failure) {
          const subject = firstSubject(message.subject);
          const last = message.info.deliveryCount >= MAX_DELIVER;
          const dead = last ? `, kept on ${DEAD}${subject.slice(4)}` : "";
          warn(
            `${subject}: ${(failure as Error).message} (delivery ${message.info.deliveryCount} of ${MAX_DELIVER}${dead})`,
          );
          if (!last) message.nak(REDELIVER_MS);
          else
            await jetstream(connection)
              .publish(`${DEAD}${subject.slice(4)}`, message.data)
              .then(
                () => message.ack(),
                (error: Error) => warn(`no dead letter of ${subject}: ${error.message}`),
              );
        }
      }
    })();
  };
  const attempt = (): Promise<void> =>
    connect({ servers: at.url, timeout: RETRY_MS, maxReconnectAttempts: -1 }).then(
      (connection) => {
        if (stopped) return connection.close();
        nats = connection;
        // A NATS without JetStream fails here, so the server does not start without durable events.
        return listen(connection);
      },
      () => {
        if (!stopped) timer = setTimeout(attempt, RETRY_MS);
      },
    );
  await attempt();
  return {
    async ping() {
      if (!nats) throw new Error("not connected to NATS");
      await nats.flush();
    },
    async deadLetters() {
      if (!nats) throw new Error("not connected to NATS");
      return deadCount(await jetstreamManager(nats));
    },
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await nats?.drain();
    },
  };
}
