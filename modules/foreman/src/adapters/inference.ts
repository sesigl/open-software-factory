// The factory's inference gateway through the inference port (ADR 0056, ADR 0070). The adapter is a program; the
// foreman starts one gateway while it serves, asks it for a key per run, and revokes the key when the run ended. A
// gateway outlives a restart of the foreman while a run has a key, so the run keeps its key and its spend (ADR 0108):
// its folder holds the gateway's ID and URL in `gateway.json` and a file per run with a key in `runs/`.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adapterRun, lastLine } from "./program.ts";

export interface Gateway {
  /** The base URL of the gateway's OpenAI-compatible API, ending in `/v1`. */
  url: string;
  /** The run's key, the same for the same run, with the most it may spend in USD. */
  key(runId: string, budget?: number): Promise<string>;
  /** Deletes the run's key; once it was tried, the run no longer keeps the gateway at a stop. */
  revoke(runId: string): Promise<void>;
  /** Stops the gateway, unless a run still has a key. */
  stop(): Promise<void>;
}

/** Whether the run got a key of the gateway whose folder this is, and the key is not revoked. */
export const hasKey = (folder: string, runId: string): boolean => existsSync(join(folder, "runs", runId));

/** Takes the gateway of the folder when the adapter still lists it, or starts one from the adapter's config file. */
export async function startGateway(
  adapter: string[],
  config: string,
  env: Record<string, string | undefined>,
  folder: string,
): Promise<Gateway> {
  // The adapter labels the gateway with its owner, so a later start removes it when this foreman was killed (ADR 0090).
  // `env` is the foreman's own environment, so its process ID belongs there.
  env.OSF_INFERENCE_OWNER = String(process.pid);
  const run = adapterRun("inference", adapter, env);
  const saved = join(folder, "gateway.json");
  const runs = join(folder, "runs");
  const kept = existsSync(saved) ? (JSON.parse(readFileSync(saved, "utf8")) as { id: string; url: string }) : undefined;
  const listed = kept ? (await run("list")).split("\n") : [];
  const { id, url } =
    kept && listed.includes(kept.id)
      ? kept
      : (JSON.parse(lastLine(await run("start", config))) as { id: string; url: string });
  mkdirSync(runs, { recursive: true });
  writeFileSync(saved, `${JSON.stringify({ id, url })}\n`);
  return {
    url,
    key: async (runId, budget) => {
      const key = lastLine(await run("key", id, runId, ...(budget === undefined ? [] : ["--budget", String(budget)])));
      writeFileSync(join(runs, runId), "");
      return key;
    },
    revoke: async (runId) => {
      try {
        await run("revoke", id, runId);
      } finally {
        // A key that the adapter could not revoke lives until the gateway stops.
        rmSync(join(runs, runId), { force: true });
      }
    },
    stop: async () => {
      if (readdirSync(runs).length > 0) return;
      await run("stop", id);
      rmSync(saved);
    },
  };
}

export interface Attached {
  /** Resolves with the gateway once a start succeeded. */
  gateway: Promise<Gateway>;
  /** Resolves when the gateway runs; rejects with the last failed start before. */
  check(): Promise<void>;
  /** Stops trying, and stops the gateway when it runs. */
  stop(): Promise<void>;
}

/**
 * Starts the gateway in the background and tries again every `retryMs` until a start succeeds, so the server starts
 * while the gateway, like the profile's LiteLLM, is not ready yet. Each new failure is a warning.
 */
export function attachGateway(start: () => Promise<Gateway>, retryMs: number, warn: (text: string) => void): Attached {
  let failure: Error = new Error("the inference gateway is starting");
  let running: Gateway | undefined;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let wake: (() => void) | undefined;
  const gateway = (async () => {
    while (!stopped) {
      try {
        const started = await start();
        if (stopped) {
          await started.stop();
          break;
        }
        running = started;
        return started;
      } catch (error) {
        if ((error as Error).message !== failure.message) warn(`${(error as Error).message}; trying again`);
        failure = error as Error;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
        timer = setTimeout(resolve, retryMs);
      });
    }
    throw new Error("the server stopped before the inference gateway started");
  })();
  // A stage awaits the gateway; while none does, a rejection is no unhandled one.
  gateway.catch(() => undefined);
  return {
    gateway,
    check: async () => {
      if (!running) throw failure;
    },
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      wake?.();
      await running?.stop();
    },
  };
}
