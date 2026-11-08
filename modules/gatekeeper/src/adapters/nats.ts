// Publishes CloudEvents to the JetStream stream "OSF" on "osf.>" (ADR 0047, 0085): each publish waits until the stream
// stored the event, so a consumer that is down gets it when it starts.

export async function publish(url: string, subject: string, event: unknown): Promise<void> {
  await publishAll(url, [{ subject, event }]);
}

/** Publishes the events in order on one connection; fails when NATS is unreachable or does not store an event. */
export async function publishAll(url: string, events: { subject: string; event: unknown }[]): Promise<void> {
  // Loaded on the first publish, so a command without GATEKEEPER_NATS_URL starts without the NATS client.
  const { connect } = await import("@nats-io/transport-node");
  const { jetstream, jetstreamManager } = await import("@nats-io/jetstream");
  const connection = await connect({ servers: url, timeout: 2000 });
  try {
    // Adding the stream again with the same configuration changes nothing.
    await (await jetstreamManager(connection)).streams.add({
      name: "OSF",
      subjects: ["osf.>"],
      max_age: 7 * 24 * 3600 * 1_000_000_000,
    });
    const stream = jetstream(connection);
    // The event's ID as the message ID: the stream keeps an event that is sent twice once.
    for (const { subject, event } of events)
      await stream.publish(subject, JSON.stringify(event), {
        msgID: (event as { id: string }).id,
      });
  } finally {
    await connection.drain();
  }
}

/** Resolves when NATS accepts a connection. */
export async function reachNats(url: string): Promise<void> {
  const { connect } = await import("@nats-io/transport-node");
  await (await connect({ servers: url, timeout: 1500 })).close();
}
