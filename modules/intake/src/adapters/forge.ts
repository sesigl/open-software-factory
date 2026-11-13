// The forge port's adapter (ADR 0057, ADR 0065): intake runs `event` on each delivery, which checks its signature with
// FORGE_WEBHOOK_SECRET and prints the delivery's CloudEvent, if any, and `comment` on an issue (ADR 0113).
import { type Delivery, type Lines, program } from "./program.ts";

export interface Forge {
  /** The CloudEvents of the delivery; undefined when the adapter refuses its signature. */
  events(delivery: Delivery): Promise<Lines | undefined>;
  /** Comments on the issue "<owner>/<name>#<number>". */
  comment(issue: string, text: string): Promise<void>;
}

export interface ForgeSettings {
  command: string;
  webhookSecret: string;
  url: string | undefined;
  token: string | undefined;
}

export function forgeAdapter(settings: ForgeSettings): Forge {
  const adapter = program(settings.command, {
    FORGE_WEBHOOK_SECRET: settings.webhookSecret,
    FORGE_URL: settings.url,
    FORGE_TOKEN: settings.token,
  });
  return {
    events: (delivery) => adapter.deliver("event", delivery),
    async comment(issue, text) {
      const [repo = "", number = ""] = issue.split("#");
      await adapter.run(["comment", repo, number, text]);
    },
  };
}
