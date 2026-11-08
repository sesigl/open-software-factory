// NATS (ADR 0067, 0085): the foreman publishes run.started@v1 and run.completed@v1 to the JetStream stream "OSF" and
// reads work.received@v1 and gate.decided@v1 through its durable consumer, so it gets the events of a time it was down.
import { AckPolicy, DeliverPolicy, jetstream, jetstreamManager } from "@nats-io/jetstream";
import { connect, type NatsConnection } from "@nats-io/transport-node";

export const SUBJECTS = {
  workReceived: "osf.work.received.v1",
  gateDecided: "osf.gate.decided.v1",
  runStarted: "osf.run.started.v1",
  runCompleted: "osf.run.completed.v1",
} as const;

const STREAM = "OSF";
/** A message whose handling failed comes again after this time, at most MAX_DELIVER times. */
const RETRY_MS = 2000;
const MAX_DELIVER = 5;

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
  close(): Promise<void>;
}

export async function openBus(url: string, warn: (text: string) => void): Promise<Bus> {
  const connection: NatsConnection = await connect({ servers: url });
  const manager = await jetstreamManager(connection);
  // Adding the stream again with the same configuration changes nothing, so every module can add it.
  await manager.streams.add({ name: STREAM, subjects: ["osf.>"] });
  const stream = jetstream(connection);
  return {
    async publish(subject, event) {
      await stream.publish(subject, JSON.stringify(event));
    },
    async consume(name, subjects, handle) {
      await manager.consumers.add(STREAM, {
        durable_name: name,
        filter_subjects: subjects,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        max_deliver: MAX_DELIVER,
      });
      const messages = await (await stream.consumers.get(STREAM, name)).consume();
      void (async () => {
        for await (const message of messages)
          await Promise.resolve()
            .then(() => handle(message.json(), message.subject))
            .then(
              () => message.ack(),
              (failure: Error) => {
                warn(
                  `${message.subject}: ${failure.message} (delivery ${message.info.deliveryCount} of ${MAX_DELIVER})`,
                );
                message.nak(RETRY_MS);
              },
            );
      })();
    },
    ping: () => connection.flush(),
    async close() {
      await connection.drain();
    },
  };
}
