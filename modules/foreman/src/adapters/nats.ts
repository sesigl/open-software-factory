// NATS (ADR 0067): the foreman publishes run.started@v1 and run.completed@v1 and listens for work.received@v1 and
// gate.decided@v1 on core NATS subjects.
import { connect, type NatsConnection } from "@nats-io/transport-node";

export const SUBJECTS = {
  workReceived: "osf.work.received.v1",
  gateDecided: "osf.gate.decided.v1",
  runStarted: "osf.run.started.v1",
  runCompleted: "osf.run.completed.v1",
} as const;

export interface Bus {
  publish(subject: string, event: unknown): Promise<void>;
  /** Calls `handle` with each message's JSON on the subject; a message that is not JSON or fails is a warning. */
  subscribe(subject: string, handle: (event: unknown) => Promise<void>): void;
  close(): Promise<void>;
}

export async function openBus(url: string, warn: (text: string) => void): Promise<Bus> {
  const connection: NatsConnection = await connect({ servers: url });
  return {
    async publish(subject, event) {
      connection.publish(subject, JSON.stringify(event));
      await connection.flush();
    },
    subscribe(subject, handle) {
      connection.subscribe(subject, {
        callback: (_error, message) => {
          Promise.resolve()
            .then(() => handle(message.json()))
            .catch((failure: Error) => warn(`${subject}: ${failure.message}`));
        },
      });
    },
    async close() {
      await connection.drain();
    },
  };
}
