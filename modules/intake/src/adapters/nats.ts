// The outbox's events to NATS as plain messages, in order, on one connection; a JetStream stream on "osf.>" keeps them.
import { connect } from "@nats-io/transport-node";

export async function publishToNats(server: string, events: { subject: string; event: unknown }[]): Promise<void> {
  const nats = await connect({ servers: server, timeout: 2000 });
  const sent = async () => {
    for (const { subject, event } of events) nats.publish(subject, JSON.stringify(event));
    await nats.flush();
  };
  await sent().finally(() => nats.close());
}
