// The handle on the module under test: its CLI, HTTP API, MCP server, ACP agent and events, its input and output folders and
// the Git repository in $INPUT.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { listFiles, quickStart } from "../support/module.ts";
import { type CliResult, mustRun, run } from "../support/process.ts";
import { type Acp, makeAcp } from "./acp.ts";
import { type Action, makeAction } from "./action.ts";
import { type Compose, makeCompose } from "./compose.ts";
import { type Events, makeEvents } from "./events.ts";
import { type Http, makeHttp } from "./http.ts";
import { adapterCommand, makeLaunch } from "./launch.ts";
import { type Mcp, makeMcp } from "./mcp.ts";

export interface Sut {
  /**
   * Runs the module's built artifact with these arguments, with $INPUT as the current directory. The module gets
   * a fixed clock and seed as `OSF_NOW` (2026-01-01T00:00:00Z) and `OSF_SEED` (1).
   */
  cli(args: string[], options?: { env?: Record<string, string> }): Promise<CliResult>;
  /**
   * Runs the module's composite GitHub Action (`action.yml`) like a runner: each `run` step in bash with $INPUT as
   * the workspace, the `GITHUB_*` variables, the event in `GITHUB_EVENT_PATH` and `RUNNER_TEMP`. The input
   * `command` is the module's built bin; `uses` steps are skipped. Steps get the same environment as `cli`.
   */
  action: Action;
  /** The module as an HTTP server. It gets the same environment as `cli`, plus `PORT`. */
  http: Http;
  /** The module as an MCP server on stdio. It gets the same environment as `cli`. */
  mcp: Mcp;
  /** The module as an ACP agent on stdio, such as a harness adapter. It gets the same environment as `cli`. */
  acp: Acp;
  /** The CloudEvents the module publishes on NATS, and events sent to it. */
  events: Events;
  /**
   * A Compose file of the unit, like "compose/compose.yaml", run with `docker compose` as the scenario's own project
   * (ADR 0074). Every call for the same scenario uses the same project.
   */
  compose(file: string): Compose;
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
    /** The absolute path of a file or folder in $INPUT or $OUTPUT, for a library whose functions take paths. */
    path(path: string): string;
  };
  /**
   * The command line of the port adapter `adapters/<port>/<name>/` of this repository, found in the module's folder
   * or a folder above it: Node and the adapter's built bin, like "node /repo/adapters/forge/forgejo/dist/cli.js".
   * Pass it to the module in its documented variable; the adapter runs as the module's child, with its network guard.
   */
  adapter(name: string): string;
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
  /** The module's private data folder, `OSF_DATA`. The test has no path into it. */
  data: string;
  /** Where the network guard logs refused connections. */
  noreal: string;
}

export function folders(workspace: string): Folders {
  const dirs = {
    input: join(workspace, "input"),
    output: join(workspace, "output"),
    data: join(workspace, "data"),
    noreal: join(workspace, "noreal.log"),
  };
  mkdirSync(dirs.input);
  mkdirSync(dirs.output);
  mkdirSync(dirs.data);
  return dirs;
}

export interface SutHandle {
  sut: Sut;
  /** Stops every server, client and subscription the scenario started, and returns the connections NOREAL refused. */
  close(): Promise<string[]>;
}

export function makeSut(moduleRoot: string, dirs: Folders, hosts: () => string[] = () => [], scenario = ""): SutHandle {
  const launch = makeLaunch(moduleRoot, dirs, hosts, scenario);
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
    action: makeAction(moduleRoot, dirs, launch),
    http: makeHttp(launch, onStop),
    mcp: makeMcp(launch, onStop),
    acp: makeAcp(launch, onStop, inside),
    events: makeEvents(onStop),
    compose: makeCompose(moduleRoot, dirs, onStop),
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
      path: inside,
    },
    adapter: (name) => adapterCommand(moduleRoot, name),
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
      if (!existsSync(dirs.noreal)) return [];
      const refused = readFileSync(dirs.noreal, "utf8").split("\n").filter(Boolean);
      rmSync(dirs.noreal);
      return [...new Set(refused)];
    },
  };
}
