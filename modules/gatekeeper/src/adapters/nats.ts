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
    // Adding the stream again with the same configuration changes nothing. A stream that intake or the foreman added
    // with a max age (OSF_STREAM_MAX_AGE) keeps it (ADR 0116).
    const manager = await jetstreamManager(connection);
    await manager.streams
      .add({ name: "OSF", subjects: ["osf.>"] })
      .catch((failure: Error) => manager.streams.info("OSF").catch(() => Promise.reject(failure)));
    const stream = jetstream(connection);
    for (const { subject, event } of events) await stream.publish(subject, JSON.stringify(event));
  } finally {
    await connection.drain();
  }
}

/** Resolves when NATS accepts a connection. */
export async function reachNats(url: string): Promise<void> {
  const { connect } = await import("@nats-io/transport-node");
  await (await connect({ servers: url, timeout: 1500 })).close();
}
