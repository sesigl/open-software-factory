// The outbox's events to the JetStream stream "OSF", in order, on one connection; each publish waits until the stream
// stored the event (ADR 0085). And the foreman's run events through the durable consumer "intake", on a connection
// that waits for NATS and connects again (ADR 0071), so the server gets the run events of a time it was down.
import { AckPolicy, DeliverPolicy, type JetStreamManager, jetstream, jetstreamManager } from "@nats-io/jetstream";
import { connect, type NatsConnection } from "@nats-io/transport-node";

const STREAM = "OSF";
const CONSUMER = "intake";
const DAY_NS = 24 * 3600 * 1_000_000_000;
const RETRY_MS = 2000;
/** A run event whose handling failed comes again after REDELIVER_MS, at most MAX_DELIVER times. */
const REDELIVER_MS = 5000;
const MAX_DELIVER = 5;

/** Adds the stream on "osf.>"; adding it again with the same configuration changes nothing. */
async function streamOf(nats: NatsConnection): Promise<JetStreamManager> {
  const manager = await jetstreamManager(nats);
  await manager.streams.add({ name: STREAM, subjects: ["osf.>"], max_age: 7 * DAY_NS });
  return manager;
}

export async function publishToNats(server: string, events: { subject: string; event: unknown }[]): Promise<void> {
  const nats = await connect({ servers: server, timeout: 2000 });
  const sent = async () => {
    await streamOf(nats);
    const stream = jetstream(nats);
    // The event's ID as the message ID: the stream keeps an event that the outbox sends twice once.
    for (const { subject, event } of events)
      await stream.publish(subject, JSON.stringify(event), { msgID: (event as { id: string }).id });
  };
  await sent().finally(() => nats.close());
}

/**
 * Calls `handle` with each message's JSON on the subjects, one message after the other, through the durable consumer
 * "intake". It tries to reach NATS every 2 seconds until it does, then reconnects on its own. A message is
 * acknowledged after `handle` resolved; a message that is not JSON, or that `handle` fails on, is a warning and comes
 * again, at most MAX_DELIVER times. Resolves after the first try, with `attached` (whether the durable consumer is
 * attached now) and `stop`, which stops listening.
 */
export async function subscribeToNats(
  server: string,
  subjects: string[],
  handle: (event: unknown) => Promise<void>,
  warn: (text: string) => void,
): Promise<{ attached(): boolean; stop(): Promise<void> }> {
  let stopped = false;
  let attached = false;
  let nats: NatsConnection | undefined;
  let timer: NodeJS.Timeout | undefined;
  const listen = async (connection: NatsConnection) => {
    const manager = await streamOf(connection);
    await manager.consumers.add(STREAM, {
      durable_name: CONSUMER,
      filter_subjects: subjects,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      max_deliver: MAX_DELIVER,
    });
    const messages = await (await jetstream(connection).consumers.get(STREAM, CONSUMER)).consume();
    attached = true;
    // NATS's status events say when the connection drops and comes back; the consumer follows the connection.
    void (async () => {
      for await (const status of connection.status())
        if (status.type === "disconnect") attached = false;
        else if (status.type === "reconnect") attached = true;
    })();
    void (async () => {
      for await (const message of messages) {
        try {
          await handle(message.json());
          message.ack();
        } catch (failure) {
          warn(
            `${message.subject}: ${(failure as Error).message} (delivery ${message.info.deliveryCount} of ${MAX_DELIVER})`,
          );
          message.nak(REDELIVER_MS);
        }
      }
    })();
  };
  const attempt = (): Promise<void> =>
    connect({ servers: server, timeout: RETRY_MS, maxReconnectAttempts: -1 }).then(
      (connection) => {
        if (stopped) return connection.close();
        nats = connection;
        // A NATS without JetStream is a warning; the server tries again.
        return listen(connection).catch(async (failure: Error) => {
          warn(`no durable consumer on NATS: ${failure.message}`);
          await connection.close();
          if (!stopped) timer = setTimeout(attempt, RETRY_MS);
        });
      },
      () => {
        if (!stopped) timer = setTimeout(attempt, RETRY_MS);
      },
    );
  await attempt();
  return {
    attached: () => attached && !nats?.isClosed(),
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await nats?.drain();
    },
  };
}
