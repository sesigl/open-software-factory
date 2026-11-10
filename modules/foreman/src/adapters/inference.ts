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
  // The adapter labels the gateway with its owner, so a later start removes it when this foreman was killed (ADR 0090).
  // `env` is the foreman's own environment, so its process ID belongs there.
  env.OSF_INFERENCE_OWNER = String(process.pid);
  const run = adapterRun("inference", adapter, env);
  const { id, url } = JSON.parse(lastLine(await run("start", config))) as { id: string; url: string };
  return {
    url,
    key: async (runId, budget) =>
      lastLine(await run("key", id, runId, ...(budget === undefined ? [] : ["--budget", String(budget)]))),
    stop: async () => void (await run("stop", id)),
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
