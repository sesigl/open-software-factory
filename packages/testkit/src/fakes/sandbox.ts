// A fake sandbox adapter (ADR 0068): a program with the commands create, exec, copy, destroy, list and probe of the
// sandbox port, whose sandboxes are folders on the host. The module runs it like any sandbox adapter; the test reads the specs
// it got, the commands it ran and the sandboxes that still exist.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tempFolder } from "../support/temp.ts";

/** The part of the `sandbox-spec` contract the fake reads. */
export interface SandboxSpec {
  template: string;
  cpu?: number;
  memory?: string;
  egress?: string[];
  env?: Record<string, string>;
  secrets?: Record<string, string>;
  mcp?: unknown[];
  /** The labels by which `list --label <name>=<value>` finds the sandbox. */
  labels?: Record<string, string>;
}

export interface SandboxOptions {
  /** The templates `create` accepts; another template exits 1 with "no template <name>". Default: every template. */
  templates?: string[];
  /** What `probe <template> <host>` reports for the denied host, as it isolates nothing. Default: "refused". */
  probe?: "refused" | "reached";
  /**
   * How long `create` takes after it logged the sandbox, and how long a `copy` out of a sandbox takes, in milliseconds,
   * as a slow image pull or a large folder does. Default: none.
   */
  takesMs?: { create?: number; copyOut?: number };
  /**
   * Sandboxes that exist when the fake starts, as a process before the module left them: the IDs 000000000001 and up,
   * in order. `created()` does not list them; `list()` does until they are destroyed. Default: none.
   */
  held?: SandboxSpec[];
}

/** One line of the fake's log: a sandbox it created, or a command it ran. */
export type SandboxLogEntry =
  | { create: string; spec: SandboxSpec }
  | { exec: string; command: string[]; files: string[] }
  | { probe: string; template: string; host: string; outcome: string };

export interface SandboxProbe {
  /** The ID of the sandbox the probe started and removed. */
  id: string;
  template: string;
  host: string;
}

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
  /** Every probe it ran, in order. */
  probes(): SandboxProbe[];
  /** The IDs of the sandboxes that exist now. */
  list(): string[];
}

/** The ID of the n-th sandbox, as the adapter counts: 000000000001 and up, in hex. */
const sandboxId = (n: number): string => n.toString(16).padStart(12, "0");

// Next to this file in the source tree and in the built package alike.
const ADAPTER = fileURLToPath(new URL(`./sandbox-adapter${extname(fileURLToPath(import.meta.url))}`, import.meta.url));

export function startSandbox(options: SandboxOptions = {}): { sandbox: Sandbox; close(): Promise<string[]> } {
  const state = tempFolder("osf-sandbox-");
  writeFileSync(join(state, "options.json"), JSON.stringify(options));
  const held = options.held ?? [];
  held.forEach((spec, index) => {
    const folder = join(state, "sandboxes", sandboxId(index + 1));
    mkdirSync(join(folder, "workspace"), { recursive: true });
    writeFileSync(join(folder, "spec.json"), JSON.stringify(spec));
  });
  // The adapter's IDs go on after the held sandboxes'.
  writeFileSync(join(state, "created"), String(held.length));
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
      probes: () =>
        entries().flatMap((entry) =>
          "probe" in entry ? [{ id: entry.probe, template: entry.template, host: entry.host }] : [],
        ),
      list: () => (existsSync(join(state, "sandboxes")) ? readdirSync(join(state, "sandboxes")).sort() : []),
    },
    async close() {
      rmSync(state, { recursive: true, force: true });
      return [];
    },
  };
}
