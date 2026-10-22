// Publishes a CloudEvent as a plain NATS message (ADR 0047); a JetStream stream on "osf.>" keeps it.
import { connect } from "@nats-io/transport-node";

export async function publish(url: string, subject: string, event: unknown): Promise<void> {
  const connection = await connect({ servers: url });
  try {
    connection.publish(subject, JSON.stringify(event));
    await connection.flush();
  } finally {
    await connection.drain();
  }
}
