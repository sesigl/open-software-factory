// The channel port's adapter as a program (ADR 0059, ADR 0063): intake runs `receive` on each delivery and `reply`
// in a thread, with the port's variables, and reads the JSON lines the adapter prints.
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ChannelSettings {
  command: string;
  apiUrl: string | undefined;
  token: string;
  signingSecret: string;
}

export interface Channel {
  /** The lines `receive` prints for a delivery; undefined when the adapter refuses its signature. */
  receive(delivery: { headers: Record<string, string>; body: string }): Promise<Record<string, unknown>[] | undefined>;
  reply(thread: string, text: string): Promise<void>;
}

export function channelAdapter(settings: ChannelSettings): Channel {
  const [file = "", ...prefix] = settings.command.trim().split(/\s+/);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CHANNEL_TOKEN: settings.token,
    CHANNEL_SIGNING_SECRET: settings.signingSecret,
  };
  if (settings.apiUrl) env.CHANNEL_API_URL = settings.apiUrl;
  const lines = (out: string) =>
    out
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  /** The lines the command printed; a command that fails rejects with what the adapter wrote to its error output. */
  const run = (args: string[]) =>
    new Promise<Record<string, unknown>[]>((done, fail) => {
      execFile(file, [...prefix, ...args], { env, encoding: "utf8" }, (error, out, err) =>
        error ? fail(new Error(`${settings.command} ${args[0]}: ${err.trim() || error.message}`)) : done(lines(out)),
      );
    });
  return {
    async receive(delivery) {
      const folder = await mkdtemp(join(tmpdir(), "intake-"));
      const path = join(folder, "delivery.json");
      await writeFile(path, JSON.stringify(delivery));
      const refused = (error: Error) => (/signature/i.test(error.message) ? undefined : Promise.reject(error));
      return run(["receive", path])
        .catch(refused)
        .finally(() => rm(folder, { recursive: true, force: true }));
    },
    async reply(thread, text) {
      await run(["reply", thread, text]);
    },
  };
}
