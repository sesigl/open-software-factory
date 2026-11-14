// NATS (ADR 0067, 0085): the foreman publishes run.started@v1 and run.completed@v1 to the JetStream stream "OSF" and
// reads work.received@v1, work.retry-requested@v1 and gate.decided@v1 through its durable consumer, so it gets the events of a time it was down.
// An event that failed MAX_DELIVER times waits as a dead letter on "osf.dead.<consumer>.>" until it is resent (ADR 0116).
import { AckPolicy, DeliverPolicy, type JetStreamManager, jetstream, jetstreamManager } from "@nats-io/jetstream";
import { connect, type NatsConnection } from "@nats-io/transport-node";

export const SUBJECTS = {
  workReceived: "osf.work.received.v1",
  workRetryRequested: "osf.work.retry-requested.v1",
  gateDecided: "osf.gate.decided.v1",
  runStarted: "osf.run.started.v1",
  runCompleted: "osf.run.completed.v1",
} as const;

const STREAM = "OSF";
/** A message whose handling failed comes again after this time, at most MAX_DELIVER times. */
const RETRY_MS = 2000;
const MAX_DELIVER = 5;
const MS_IN_NANOS = 1_000_000;

export interface Bus {
  publish(subject: string, event: unknown): Promise<void>;
  /**
   * Calls `handle` with the JSON and the subject of each message on the subjects, one after the other, through the durable consumer
   * `name`. A message is acknowledged after `handle` resolved. A message that is not JSON, or that `handle` fails on, is a
   * warning and comes again, at most MAX_DELIVER times.
   */
  consume(name: string, subjects: string[], handle: (event: unknown, subject: string) => Promise<void>): Promise<void>;
  /** One round trip to NATS: it waits while the connection is down, and fails when the connection is closed. */
  ping(): Promise<void>;
  /** How many events of the consumer `name` failed MAX_DELIVER times and wait as dead letters. */
  deadLetters(name: string): Promise<number>;
  /**
   * Sends the dead letters of the consumer `name` again, on "osf.resend.<name>.>", which its consumer also reads, and
   * removes them; the subjects they came on first.
   */
  resend(name: string): Promise<string[]>;
  close(): Promise<void>;
}

/** The dead letters of a consumer by their subject, and how many wait on each. */
async function deadOf(manager: JetStreamManager, name: string): Promise<Record<string, number>> {
  return (await manager.streams.info(STREAM, { subjects_filter: `osf.dead.${name}.>` })).state.subjects ?? {};
}

/**
 * Adding the stream again with the same configuration changes nothing, so every module can add it. When another
 * module added it with another max age, the stream gets `maxAgeMs`, or keeps its own when it is unset (ADR 0116).
 */
async function addStream(manager: JetStreamManager, maxAgeMs: number | undefined): Promise<void> {
  const config = { name: STREAM, subjects: ["osf.>"], max_age: (maxAgeMs ?? 0) * MS_IN_NANOS };
  try {
    await manager.streams.add(config);
  } catch (failure) {
    if (maxAgeMs) await manager.streams.update(STREAM, { max_age: config.max_age });
    else if (!(await manager.streams.info(STREAM).catch(() => undefined))) throw failure;
  }
}

export async function openBus(url: string, warn: (text: string) => void, maxAgeMs?: number): Promise<Bus> {
  const connection: NatsConnection = await connect({ servers: url });
  const manager = await jetstreamManager(connection);
  await addStream(manager, maxAgeMs);
  const stream = jetstream(connection);
  return {
    async publish(subject, event) {
      await stream.publish(subject, JSON.stringify(event));
    },
    async consume(name, subjects, handle) {
      const resent = `osf.resend.${name}.`;
      const filter_subjects = [...subjects, `${resent}>`];
      // The consumer of an earlier version did not read the resent events; it then reads them (ADR 0116).
      await manager.consumers
        .add(STREAM, {
          durable_name: name,
          filter_subjects,
          ack_policy: AckPolicy.Explicit,
          deliver_policy: DeliverPolicy.All,
          max_deliver: MAX_DELIVER,
        })
        .catch(() => manager.consumers.update(STREAM, name, { filter_subjects }));
      const messages = await (await stream.consumers.get(STREAM, name)).consume();
      void (async () => {
        for await (const message of messages) {
          const first = message.subject.replace(resent, "osf.");
          await Promise.resolve()
            .then(() => handle(message.json(), first))
            .then(
              () => message.ack(),
              async (failure: Error) => {
                const count = message.info.deliveryCount;
                const dead = `osf.dead.${name}.${first.slice("osf.".length)}`;
                const kept = count < MAX_DELIVER ? "" : `, kept on ${dead}`;
                warn(`${first}: ${failure.message} (delivery ${count} of ${MAX_DELIVER}${kept})`);
                if (!kept) return message.nak(RETRY_MS);
                await stream.publish(dead, message.data).then(
                  () => message.ack(),
                  (lost: Error) => warn(`${first}: no dead letter: ${lost.message}`),
                );
              },
            );
        }
      })();
    },
    ping: () => connection.flush(),
    async deadLetters(name) {
      return Object.values(await deadOf(manager, name)).reduce((all, waiting) => all + waiting, 0);
    },
    async resend(name) {
      const sent: string[] = [];
      for (const subject of Object.keys(await deadOf(manager, name)).sort()) {
        let letter = await manager.streams.getMessage(STREAM, { last_by_subj: subject }).catch(() => null);
        while (letter) {
          const rest = subject.slice(`osf.dead.${name}.`.length);
          await stream.publish(`osf.resend.${name}.${rest}`, letter.data);
          await manager.streams.deleteMessage(STREAM, letter.seq);
          sent.push(`osf.${rest}`);
          letter = await manager.streams.getMessage(STREAM, { last_by_subj: subject }).catch(() => null);
        }
      }
      return sent;
    },
    async close() {
      await connection.drain();
    },
  };
}
