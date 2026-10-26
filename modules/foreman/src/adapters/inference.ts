// The factory's inference gateway through the inference port (ADR 0056, ADR 0070). The adapter is a program; the
// foreman starts one gateway while it serves, asks it for a key per run, and stops it at the end.
import { adapterRun, lastLine } from "./program.ts";

export interface Gateway {
  /** The base URL of the gateway's OpenAI-compatible API, ending in `/v1`. */
  url: string;
  /** A new key for the run, with the most it may spend in USD. */
  key(runId: string, budget?: number): Promise<string>;
  stop(): Promise<void>;
}

/** Starts a gateway from the adapter's config file. */
export async function startGateway(
  adapter: string[],
  config: string,
  env: Record<string, string | undefined>,
): Promise<Gateway> {
  const run = adapterRun("inference", adapter, env);
  const { id, url } = JSON.parse(lastLine(await run("start", config))) as { id: string; url: string };
  return {
    url,
    key: async (runId, budget) =>
      lastLine(await run("key", id, runId, ...(budget === undefined ? [] : ["--budget", String(budget)]))),
    stop: async () => void (await run("stop", id)),
  };
}
