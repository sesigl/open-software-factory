// A fake sandbox adapter (ADR 0068): a program with the commands create, exec, copy, destroy and list of the sandbox
// port, whose sandboxes are folders on the host. The module runs it like any sandbox adapter; the test reads the specs
// it got, the commands it ran and the sandboxes that still exist.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The part of the `sandbox-spec` contract the fake reads. */
export interface SandboxSpec {
  template: string;
  cpu?: number;
  memory?: string;
  egress?: string[];
  env?: Record<string, string>;
  secrets?: Record<string, string>;
  mcp?: unknown[];
}

export interface SandboxOptions {
  /** The templates `create` accepts; another template exits 1 with "no template <name>". Default: every template. */
  templates?: string[];
}

/** One line of the fake's log: a sandbox it created, or a command it ran. */
export type SandboxLogEntry =
  | { create: string; spec: SandboxSpec }
  | { exec: string; command: string[]; files: string[] };

export interface SandboxExec {
  /** The sandbox's ID. */
  id: string;
  command: string[];
  /** The files in the sandbox's working folder when the command started, by path, sorted. */
  files: string[];
}

export interface Sandbox {
  /** Run the adapter with this command and these arguments, then the port's command, like `create spec.json`. */
  command: string;
  args: string[];
  /** The spec of each sandbox it created, by ID, in order. */
  created(): { id: string; spec: SandboxSpec }[];
  /** Every command it ran in a sandbox, in order. */
  execs(): SandboxExec[];
  /** The IDs of the sandboxes that exist now. */
  list(): string[];
}

// Next to this file in the source tree and in the built package alike.
const ADAPTER = fileURLToPath(new URL(`./sandbox-adapter${extname(fileURLToPath(import.meta.url))}`, import.meta.url));

export function startSandbox(options: SandboxOptions = {}): { sandbox: Sandbox; close(): Promise<string[]> } {
  const state = mkdtempSync(join(tmpdir(), "osf-sandbox-"));
  writeFileSync(join(state, "options.json"), JSON.stringify(options));
  const logFile = join(state, "log.jsonl");
  const entries = (): SandboxLogEntry[] =>
    existsSync(logFile)
      ? readFileSync(logFile, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];
  return {
    sandbox: {
      command: process.execPath,
      args: [ADAPTER, state],
      created: () => entries().flatMap((entry) => ("create" in entry ? [{ id: entry.create, spec: entry.spec }] : [])),
      execs: () =>
        entries().flatMap((entry) =>
          "exec" in entry ? [{ id: entry.exec, command: entry.command, files: entry.files }] : [],
        ),
      list: () => (existsSync(join(state, "sandboxes")) ? readdirSync(join(state, "sandboxes")).sort() : []),
    },
    async close() {
      rmSync(state, { recursive: true, force: true });
      return [];
    },
  };
}
