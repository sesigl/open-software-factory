// Publishes CloudEvents as plain NATS messages (ADR 0047); a JetStream stream on "osf.>" keeps them.

export async function publish(url: string, subject: string, event: unknown): Promise<void> {
  await publishAll(url, [{ subject, event }]);
}

/** Publishes the events in order on one connection; fails when NATS is unreachable. */
export async function publishAll(url: string, events: { subject: string; event: unknown }[]): Promise<void> {
  // Loaded on the first publish, so a command without GATEKEEPER_NATS_URL starts without the NATS client.
  const { connect } = await import("@nats-io/transport-node");
  const connection = await connect({ servers: url, timeout: 2000 });
  try {
    for (const { subject, event } of events) connection.publish(subject, JSON.stringify(event));
    await connection.flush();
  } finally {
    await connection.drain();
  }
}
