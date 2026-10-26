// The forge port's adapter (ADR 0057, ADR 0065): intake runs `event` on each delivery, which checks its signature with
// FORGE_WEBHOOK_SECRET and prints the delivery's CloudEvent, if any.
import { type Delivery, type Lines, program } from "./program.ts";

export interface Forge {
  /** The CloudEvents of the delivery; undefined when the adapter refuses its signature. */
  events(delivery: Delivery): Promise<Lines | undefined>;
}

export function forgeAdapter(command: string, webhookSecret: string): Forge {
  const adapter = program(command, { FORGE_WEBHOOK_SECRET: webhookSecret });
  return {
    events: (delivery) => adapter.deliver("event", delivery),
  };
}
