// A fake inference adapter (ADR 0070): a program with the commands start, key, revoke, spend-log, stop and list of the
// inference port (ADR 0108). It serves no gateway: start prints the URL from its options. The module runs it like any inference adapter; the
// test reads the configs it started from, the keys it made and the gateways that still exist.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tempFolder } from "../support/temp.ts";

export interface InferenceOptions {
  /** The URL `start` prints for every gateway. Default: "http://127.0.0.1:4000/v1". */
  url?: string;
  /** Every command exits 1 and writes this message to standard error. */
  fails?: string;
  /** `start` exits 1 and writes this message to standard error until the test calls `ready()`. */
  startFails?: string;
  /** `revoke` exits 1 and writes this message to standard error. */
  revokeFails?: string;
}

/** One line of the fake's log: a gateway it started, a key it made, or a run whose key it revoked. */
export type InferenceLogEntry =
  | { start: string; config: string }
  | { key: string; gateway: string; run: string; budget?: string }
  | { revoke: string; gateway: string };

export interface Inference {
  /** Run the adapter with this command and these arguments, then the port's command, like `start config.yaml`. */
  command: string;
  args: string[];
  /** Each gateway it started, by ID, with the text of its config, in order. */
  started(): { id: string; config: string }[];
  /** Each key it made, with its gateway, its run and its budget as the command line gave it, in order; one per run. */
  keys(): { key: string; gateway: string; run: string; budget?: string }[];
  /** Each revoke that succeeded, with its gateway and its run, in order. */
  revoked(): { gateway: string; run: string }[];
  /** The IDs of the gateways that exist now. */
  list(): string[];
  /** From now on, `start` works, also with `startFails`. */
  ready(): void;
}

// Next to this file in the source tree and in the built package alike.
const ADAPTER = fileURLToPath(
  new URL(`./inference-adapter${extname(fileURLToPath(import.meta.url))}`, import.meta.url),
);

export function startInference(options: InferenceOptions = {}): { inference: Inference; close(): Promise<string[]> } {
  const state = tempFolder("osf-inference-");
  writeFileSync(join(state, "options.json"), JSON.stringify(options));
  const logFile = join(state, "log.jsonl");
  const entries = (): InferenceLogEntry[] =>
    existsSync(logFile)
      ? readFileSync(logFile, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];
  return {
    inference: {
      command: process.execPath,
      args: [ADAPTER, state],
      started: () =>
        entries().flatMap((entry) => ("start" in entry ? [{ id: entry.start, config: entry.config }] : [])),
      keys: () => entries().flatMap((entry) => ("key" in entry ? [entry] : [])),
      revoked: () =>
        entries().flatMap((entry) => ("revoke" in entry ? [{ gateway: entry.gateway, run: entry.revoke }] : [])),
      list: () => (existsSync(join(state, "gateways")) ? readdirSync(join(state, "gateways")).sort() : []),
      ready: () => writeFileSync(join(state, "ready"), ""),
    },
    async close() {
      rmSync(state, { recursive: true, force: true });
      return [];
    },
  };
}
