// The forge port's adapter as a program (ADR 0060): factory-spec starts its command line with the port's variables
// and reads the JSON lines it prints. The adapter talks to the forge.
import { runAdapter } from "@opensoftware/cli";

/** A webhook as the port prints it and factory-spec records and compares it. */
export interface Hook {
  id: number;
  url: string;
  events: string[];
  active: boolean;
}

export interface Forge {
  /** The webhooks of the repository. */
  hooks(repository: string): Promise<Hook[]>;
  /** Registers the URL for the port's events; a webhook with that URL is updated. */
  webhook(repository: string, url: string, events: string[]): Promise<Hook>;
  unhook(repository: string, id: number): Promise<void>;
}

/** How to reach one forge: its adapter's command line, the forge's URL and token, and the webhooks' secret. */
export interface ForgeSettings {
  command: string;
  url: string;
  token: string;
  secret: string | undefined;
}

export function forgeAdapter(settings: ForgeSettings): Forge {
  const env = {
    ...process.env,
    FORGE_URL: settings.url,
    FORGE_TOKEN: settings.token,
    ...(settings.secret !== undefined && { FORGE_WEBHOOK_SECRET: settings.secret }),
  };
  const run = (args: string[]): Promise<unknown[]> =>
    runAdapter({ name: "forge adapter", command: settings.command, env }, args);
  return {
    async hooks(repository) {
      return (await run(["hooks", repository])) as Hook[];
    },
    async webhook(repository, url, events) {
      const [hook] = await run(["webhook", repository, url, ...events.flatMap((event) => ["--event", event])]);
      return hook as Hook;
    },
    async unhook(repository, id) {
      await run(["unhook", repository, String(id)]);
    },
  };
}
