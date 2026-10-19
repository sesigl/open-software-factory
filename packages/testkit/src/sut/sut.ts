// The handle on the module under test: its CLI, HTTP API, MCP server and events, its input and output folders and
// the Git repository in $INPUT.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { listFiles, quickStart } from "../support/module.ts";
import { type CliResult, mustRun, run } from "../support/process.ts";
import { type Events, makeEvents } from "./events.ts";
import { type Http, makeHttp } from "./http.ts";
import { makeLaunch } from "./launch.ts";
import { type Mcp, makeMcp } from "./mcp.ts";

export interface Sut {
  /**
   * Runs the module's built artifact with these arguments, with $INPUT as the current directory. The module gets
   * a fixed clock and seed as `OSF_NOW` (2026-01-01T00:00:00Z) and `OSF_SEED` (1).
   */
  cli(args: string[], options?: { env?: Record<string, string> }): Promise<CliResult>;
  /** The module as an HTTP server. It gets the same environment as `cli`, plus `PORT`. */
  http: Http;
  /** The module as an MCP server on stdio. It gets the same environment as `cli`. */
  mcp: Mcp;
  /** The CloudEvents the module publishes on NATS, and events sent to it. */
  events: Events;
  /**
   * The module's input and output folders. Every path starts with `$INPUT/` or `$OUTPUT/` and stays inside that
   * folder; the module gets them as the environment variables `INPUT` and `OUTPUT`.
   */
  files: {
    put(path: string, content: string): Promise<void>;
    read(path: string): Promise<string>;
    list(dir?: string): Promise<string[]>;
    remove(path: string): Promise<void>;
    /** Removes everything inside the folder and keeps the folder. */
    clear(path: string): Promise<void>;
  };
  /** What the module's README promises in its Quick start section. */
  readme: {
    /** The arguments of the first `npx <package> ...` line. */
    quickStartArgs(): string[];
    /** The first `$OUTPUT/<path>` in backticks, as a path below $OUTPUT. */
    quickStartOutput(): string;
  };
  /** $INPUT is a Git repository with a fixed author and clock. */
  git: {
    commit(message: string): Promise<string>;
    /** Tags the current commit, for example a release tag. */
    tag(name: string): Promise<void>;
  };
}

export interface Folders {
  input: string;
  output: string;
}

export function folders(workspace: string): Folders {
  const input = join(workspace, "input");
  const output = join(workspace, "output");
  mkdirSync(input);
  mkdirSync(output);
  return { input, output };
}

export interface SutHandle {
  sut: Sut;
  /** Stops every server, client and subscription the scenario started. */
  close(): Promise<void>;
}

export function makeSut(moduleRoot: string, dirs: Folders): SutHandle {
  const launch = makeLaunch(moduleRoot, dirs);
  const stops: (() => Promise<unknown>)[] = [];
  const onStop = (stop: () => Promise<unknown>): void => {
    stops.push(stop);
  };
  const input = dirs.input;
  const inside = (path: string): string => {
    const [, name, rest = ""] = /^\$(INPUT|OUTPUT)(?:\/(.*))?$/s.exec(path) ?? [];
    const root = name === "INPUT" ? dirs.input : name === "OUTPUT" ? dirs.output : undefined;
    const full = root && resolve(root, rest);
    if (!root || !full || (full !== root && !full.startsWith(root + sep))) {
      throw new Error(`sut.files refuses a path outside $INPUT and $OUTPUT: ${path}`);
    }
    return full;
  };
  const sut: Sut = {
    async cli(args, options = {}) {
      const { command, argv, cwd, env } = launch(args, options.env);
      return run(command, argv, cwd, env);
    },
    http: makeHttp(launch, onStop),
    mcp: makeMcp(launch, onStop),
    events: makeEvents(onStop),
    files: {
      async put(path, content) {
        const full = inside(path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
      },
      async read(path) {
        return readFileSync(inside(path), "utf8");
      },
      async list(dir = "$INPUT") {
        return listFiles(inside(dir)).map((file) => relative(inside(dir), file));
      },
      async remove(path) {
        rmSync(inside(path), { recursive: true, force: true });
      },
      async clear(path) {
        const folder = inside(path);
        for (const entry of readdirSync(folder)) rmSync(join(folder, entry), { recursive: true, force: true });
      },
    },
    readme: {
      quickStartArgs: () => quickStart(moduleRoot).args,
      quickStartOutput: () => quickStart(moduleRoot).output,
    },
    git: {
      async commit(message) {
        await mustRun("git", ["add", "-A"], input);
        await mustRun("git", ["commit", "-q", "--allow-empty", "-m", message], input);
        return (await mustRun("git", ["rev-parse", "HEAD"], input)).stdout.trim();
      },
      async tag(name) {
        await mustRun("git", ["tag", name], input);
      },
    },
  };
  return {
    sut,
    async close() {
      // Last started, first stopped: a server stops before the subscription that watches it.
      for (const stop of stops.splice(0).reverse()) await stop().catch(() => undefined);
    },
  };
}
