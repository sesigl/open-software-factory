// The outbox's events to NATS as plain messages, in order, on one connection; a JetStream stream on "osf.>" keeps them.
// And the foreman's run events from NATS, on a connection that waits for NATS and connects again (ADR 0071).
import { connect, type NatsConnection } from "@nats-io/transport-node";

export async function publishToNats(server: string, events: { subject: string; event: unknown }[]): Promise<void> {
  const nats = await connect({ servers: server, timeout: 2000 });
  const sent = async () => {
    for (const { subject, event } of events) nats.publish(subject, JSON.stringify(event));
    await nats.flush();
  };
  await sent().finally(() => nats.close());
}

const RETRY_MS = 2000;

/**
 * Calls `handle` with each message's JSON on the subjects, one message of a subject after the other. It tries to reach
 * NATS every 2 seconds until it does, then reconnects on its own. A message that is not JSON or that `handle` fails on
 * is a warning. Resolves after the first try, with the function that stops listening.
 */
export async function subscribeToNats(
  server: string,
  subjects: string[],
  handle: (event: unknown) => Promise<void>,
  warn: (text: string) => void,
): Promise<() => Promise<void>> {
  let stopped = false;
  let nats: NatsConnection | undefined;
  let timer: NodeJS.Timeout | undefined;
  /** Handles the subject's messages one after the other, in the order NATS delivers them. */
  const drain = async (subject: string, messages: AsyncIterable<{ json(): unknown }>) => {
    for await (const message of messages)
      await Promise.resolve()
        .then(() => handle(message.json()))
        .catch((failure: Error) => warn(`${subject}: ${failure.message}`));
  };
  const listen = async (connection: NatsConnection) => {
    for (const subject of subjects) void drain(subject, connection.subscribe(subject));
    // The server has the subscriptions once the flush returns.
    await connection.flush();
  };
  const attempt = (): Promise<void> =>
    connect({ servers: server, timeout: RETRY_MS, maxReconnectAttempts: -1 }).then(
      (connection) => {
        if (stopped) return connection.close();
        nats = connection;
        return listen(connection);
      },
      () => {
        if (!stopped) timer = setTimeout(attempt, RETRY_MS);
      },
    );
  await attempt();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await nats?.drain();
  };
}
