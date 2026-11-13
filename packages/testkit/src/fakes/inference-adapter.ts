// The inference adapter that fakes.inference() hands a module: node inference-adapter.ts <state folder> <command> ...
// It has the commands start, key, revoke, spend-log, stop and list of the inference port (ADR 0056, ADR 0108). A gateway
// is the file <state>/gateways/<ID>; start prints the URL from the options and serves nothing there (ADR 0070). A
// run's key is the file <state>/run-keys/<ID>-<run ID>, so key prints the same key for the same run. It logs each config,
// each new key and each revoke for the test.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { InferenceLogEntry, InferenceOptions } from "./inference.ts";

const [state, command, ...args] = process.argv.slice(2) as [string, string, ...string[]];
const root = join(state, "gateways");
const options = JSON.parse(readFileSync(join(state, "options.json"), "utf8")) as InferenceOptions;
const log = (entry: InferenceLogEntry): void => appendFileSync(join(state, "log.jsonl"), `${JSON.stringify(entry)}\n`);

function fail(message: string, code = 1): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

/** The next number of a counter in the state folder; numbers are never used again. */
function counted(name: string): number {
  const file = join(state, name);
  const next = existsSync(file) ? Number(readFileSync(file, "utf8")) + 1 : 1;
  writeFileSync(file, String(next));
  return next;
}

/** Fails unless the gateway exists. */
function gateway(id: string | undefined): string {
  if (!id || !existsSync(join(root, id))) fail(`no gateway ${id}`);
  return id;
}

const commands: Record<string, () => void> = {
  start() {
    if (options.startFails && !existsSync(join(state, "ready"))) fail(options.startFails);
    const config = readFileSync(args[0] as string, "utf8");
    const id = counted("started").toString(16).padStart(12, "0");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, id), "");
    log({ start: id, config });
    process.stdout.write(`${JSON.stringify({ id, url: options.url ?? "http://127.0.0.1:4000/v1" })}\n`);
  },
  key() {
    const [id, run, flag, budget] = args;
    const file = join(state, "run-keys", `${gateway(id)}-${run}`);
    if (!existsSync(file)) {
      const key = `sk-fake-${counted("keys")}`;
      mkdirSync(join(state, "run-keys"), { recursive: true });
      writeFileSync(file, key);
      log({ key, gateway: id as string, run: run as string, ...(flag === "--budget" ? { budget } : {}) });
    }
    process.stdout.write(`${readFileSync(file, "utf8")}\n`);
  },
  revoke() {
    const [id, run] = args;
    if (options.revokeFails) fail(options.revokeFails);
    rmSync(join(state, "run-keys", `${gateway(id)}-${run}`), { force: true });
    log({ revoke: run as string, gateway: id as string });
  },
  "spend-log"() {
    gateway(args[0]);
  },
  stop() {
    rmSync(join(root, gateway(args[0])));
  },
  list() {
    for (const id of existsSync(root) ? readdirSync(root) : []) process.stdout.write(`${id}\n`);
  },
};

if (options.fails) fail(options.fails);
(commands[command] ?? (() => fail(`the fake inference adapter has no command ${command}`, 2)))();
