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
  /** Calls `handle` with each message's JSON on the subject; a message that is not JSON is skipped. */
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
        callback: (error, message) => {
          if (error) return;
          let event: unknown;
          try {
            event = message.json();
          } catch {
            return warn(`${subject}: a message that is not JSON`);
          }
          handle(event).catch((failure: unknown) =>
            warn(`${subject}: ${failure instanceof Error ? failure.message : String(failure)}`),
          );
        },
      });
    },
    async close() {
      await connection.drain();
    },
  };
}
