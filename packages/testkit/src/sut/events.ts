// sut.events: the CloudEvents a module publishes on NATS, and events the test sends to it.
import { connect } from "@nats-io/transport-node";
import type { Nats } from "../fakes/services.ts";

/** A CloudEvent in structured JSON mode. */
export interface CloudEvent {
  specversion: string;
  id: string;
  source: string;
  type: string;
  subject?: string;
  time?: string;
  datacontenttype?: string;
  data?: unknown;
  [extension: string]: unknown;
}

export interface EventLog {
  /** Publishes a CloudEvent as JSON on the subject, as another module would. */
  publish(subject: string, event: CloudEvent): Promise<void>;
  /** Waits until at least `count` events of this type arrived, and returns every event of that type. */
  received(type: string, options?: { count?: number; timeoutMs?: number }): Promise<CloudEvent[]>;
}

/** A JetStream stream as the server has it. */
export interface Stream {
  subjects: string[];
  /** The age after which the stream drops a message, in milliseconds; 0 without a limit. */
  maxAgeMs: number;
  /** The number of messages it keeps. */
  messages: number;
}

export interface Events {
  /** Records every message on these NATS subjects (default: all) from now on. Start it before the module acts. */
  watch(nats: Nats, subjects?: string): Promise<EventLog>;
  /**
   * The JetStream stream `name` on the server, or undefined when there is none. With `add`, it first adds the stream
   * with these subjects and max age, as another module would.
   */
  stream(nats: Nats, name: string, add?: { subjects: string[]; maxAgeMs?: number }): Promise<Stream | undefined>;
}

const NANOS_PER_MS = 1_000_000;

export function makeEvents(onStop: (stop: () => Promise<unknown>) => void): Events {
  return {
    // The JetStream API on plain NATS requests, so the testkit needs no JetStream client.
    async stream(nats, name, add) {
      const connection = await connect({ servers: nats.url });
      const ask = async (verb: string, body?: unknown) =>
        (await connection.request(`$JS.API.STREAM.${verb}.${name}`, body ? JSON.stringify(body) : "")).json<{
          error?: { code: number; description: string };
          config?: { subjects: string[]; max_age: number };
          state?: { messages: number };
        }>();
      try {
        if (add) {
          const created = await ask("CREATE", {
            name,
            subjects: add.subjects,
            max_age: (add.maxAgeMs ?? 0) * NANOS_PER_MS,
          });
          if (created.error) throw new Error(`sut.events: the stream ${name}: ${created.error.description}`);
        }
        const info = await ask("INFO");
        if (info.error?.code === 404 || !info.config || !info.state) return undefined;
        return {
          subjects: info.config.subjects,
          maxAgeMs: info.config.max_age / NANOS_PER_MS,
          messages: info.state.messages,
        };
      } finally {
        await connection.close();
      }
    },
    async watch(nats, subjects = ">") {
      const connection = await connect({ servers: nats.url });
      onStop(() => connection.drain());
      const seen: { subject: string; event?: CloudEvent; text: string }[] = [];
      const subscription = connection.subscribe(subjects, {
        callback: (error, message) => {
          if (error) return;
          const text = message.string();
          seen.push({ subject: message.subject, event: asCloudEvent(text), text });
        },
      });
      // The server knows the subscription before the test lets the module act.
      await connection.flush();
      return {
        async publish(subject, event) {
          connection.publish(subject, JSON.stringify(event));
          await connection.flush();
        },
        async received(type, options = {}) {
          const { count = 1, timeoutMs = 10_000 } = options;
          const deadline = Date.now() + timeoutMs;
          const ofType = () => seen.flatMap(({ event }) => (event?.type === type ? [event] : []));
          while (ofType().length < count) {
            if (Date.now() > deadline || subscription.isClosed()) {
              const got = seen.map(
                ({ subject, event, text }) => `  ${subject}: ${event ? event.type : `not a CloudEvent: ${text}`}`,
              );
              throw new Error(
                `sut.events: expected ${count} event(s) of type ${type} on "${subjects}" within ${timeoutMs} ms, got:\n${got.join("\n") || "  nothing"}`,
              );
            }
            await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
          }
          return ofType();
        },
      };
    },
  };
}

function asCloudEvent(text: string): CloudEvent | undefined {
  try {
    const value = JSON.parse(text) as Partial<CloudEvent> | null;
    const valid = ["specversion", "id", "source", "type"].every((key) => typeof value?.[key] === "string");
    return valid ? (value as CloudEvent) : undefined;
  } catch {
    return undefined;
  }
}
