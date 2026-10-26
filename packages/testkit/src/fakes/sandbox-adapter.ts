// The sandbox adapter that fakes.sandbox() hands a module: node sandbox-adapter.ts <state folder> <command> ...
// It has the commands create, exec, copy, destroy and list of the sandbox port (ADR 0054). A sandbox is the folder
// <state>/sandboxes/<ID>/workspace on the host, and exec runs the command there with the spec's variables and a
// placeholder for each secret. It isolates nothing (ADR 0068). It logs each spec and each exec for the test.
import { spawn } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, posix, relative } from "node:path";
import type { SandboxLogEntry, SandboxSpec } from "./sandbox.ts";

const [state, command, ...args] = process.argv.slice(2) as [string, string, ...string[]];
const root = join(state, "sandboxes");
const options = JSON.parse(readFileSync(join(state, "options.json"), "utf8")) as { templates?: string[] };
const log = (entry: SandboxLogEntry): void => appendFileSync(join(state, "log.jsonl"), `${JSON.stringify(entry)}\n`);

function fail(message: string, code = 1): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

/** The folder of an existing sandbox. */
function sandbox(id: string | undefined): string {
  const folder = join(root, id ?? "");
  if (!id || !existsSync(folder)) fail(`no sandbox ${id}`);
  return folder;
}

/** The host path of `<ID>:<path>`: a relative path, or one below /workspace, is below the sandbox's folder. */
function inSandbox(end: string): string | undefined {
  const match = /^([0-9a-f]{12}):(.+)$/.exec(end);
  if (!match) return undefined;
  const path = posix.resolve("/workspace", match[2] as string);
  return join(sandbox(match[1]), "workspace", posix.relative("/workspace", path));
}

const commands: Record<string, () => void> = {
  create() {
    const spec = JSON.parse(readFileSync(args[0] as string, "utf8")) as SandboxSpec;
    if (options.templates && !options.templates.includes(spec.template)) fail(`no template ${spec.template}`);
    // IDs count up and are never used again, also after a destroy.
    const counter = join(state, "created");
    const created = existsSync(counter) ? Number(readFileSync(counter, "utf8")) + 1 : 1;
    writeFileSync(counter, String(created));
    const id = created.toString(16).padStart(12, "0");
    mkdirSync(join(root, id, "workspace"), { recursive: true });
    cpSync(args[0] as string, join(root, id, "spec.json"));
    log({ create: id, spec });
    process.stdout.write(`${id}\n`);
  },
  exec() {
    const [id, , program, ...rest] = args;
    const folder = sandbox(id);
    const spec = JSON.parse(readFileSync(join(folder, "spec.json"), "utf8")) as SandboxSpec;
    const workspace = join(folder, "workspace");
    const files = readdirSync(workspace, { recursive: true, encoding: "utf8" }).map((file) =>
      relative(workspace, join(workspace, file)),
    );
    log({ exec: id as string, command: [program as string, ...rest], files: files.sort() });
    const placeholders = Object.keys(spec.secrets ?? {}).map((name) => [name, `osf-secret-placeholder-${name}`]);
    const env = { ...process.env, ...spec.env, ...Object.fromEntries(placeholders) };
    const child = spawn(program as string, rest, { cwd: workspace, env, stdio: "inherit" });
    child.on("exit", (code) => process.exit(code ?? 1));
    child.on("error", (error) => fail(error.message, 127));
  },
  copy() {
    const [from, to] = args as [string, string];
    cpSync(inSandbox(from) ?? from, inSandbox(to) ?? to, { recursive: true });
  },
  destroy() {
    rmSync(sandbox(args[0]), { recursive: true });
    process.stdout.write(`destroyed ${args[0]}\n`);
  },
  list() {
    for (const id of existsSync(root) ? readdirSync(root) : []) process.stdout.write(`${id}\n`);
  },
};

(commands[command] ?? (() => fail(`the fake sandbox has no command ${command}`, 2)))();
