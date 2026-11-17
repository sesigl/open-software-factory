// The handle on the module under test: its CLI, HTTP API, MCP server, ACP agent and events, its input and output folders and
// the Git repository in $INPUT.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { listFiles, quickStart } from "../support/module.ts";
import { type CliResult, mustRun, run } from "../support/process.ts";
import { type Acp, makeAcp } from "./acp.ts";
import { type Action, makeAction } from "./action.ts";
import { type Browser, makeBrowser } from "./browser.ts";
import { type Compose, makeCompose } from "./compose.ts";
import { type Events, makeEvents } from "./events.ts";
import { type Folders, folders, foldersOf } from "./folders.ts";
import { type Helm, makeHelm } from "./helm.ts";
import { type Http, makeHttp } from "./http.ts";
import { adapterCommand, makeLaunch } from "./launch.ts";
import { type Mcp, makeMcp } from "./mcp.ts";
import { makePages, type Pages } from "./pages.ts";
import { makeShared, type Shared, type SharedSut } from "./shared.ts";
import { makeSite, type Site } from "./site.ts";

export { type Folders, folders };

export interface Sut {
  /**
   * Runs the module's built artifact with these arguments, with $INPUT as the current directory. The module gets
   * a fixed clock and seed as `OSF_NOW` (2026-01-01T00:00:00Z) and `OSF_SEED` (1), and `OSF_TEST_HOOKS=1`, the switch
   * without which a module refuses these test hooks (ADR 0166). `stdin` is written to its
   * standard input, which is then closed.
   */
  cli(args: string[], options?: { env?: Record<string, string>; stdin?: string }): Promise<CliResult>;
  /**
   * Runs the module's composite GitHub Action (`action.yml`) like a runner: each `run` step in bash with $INPUT as
   * the workspace, the `GITHUB_*` variables, the event in `GITHUB_EVENT_PATH` and `RUNNER_TEMP`. The input
   * `command` is the module's built bin; `uses` steps are skipped. Steps get the same environment as `cli`.
   */
  action: Action;
  /** The module as an HTTP server. It gets the same environment as `cli`, plus `PORT`. */
  http: Http;
  /**
   * The pages of the server sut.http started, read as a person reads them but without a browser: by role, accessible
   * name, label and text. Links and forms keep the scenario's cookies, as a browser does (ADR 0131).
   */
  pages: Pages;
  /**
   * The pages of the server sut.http started, or of the folder sut.site serves, in Chromium, for a journey or an island
   * scenario (ADR 0131): one browser per test process and a context per scenario. A request that leaves loopback, an
   * error in the browser's console and a failed request fail the scenario. During a mutation run the page gets
   * Stryker's active mutant before its first script (ADR 0152).
   */
  browser: Browser;
  /** A folder of the unit as a static site on loopback, such as the workbench of an island scenario (ADR 0152). */
  site: Site;
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
   * A Helm chart of the unit, like "helm/osf", installed with `helm` in a Kubernetes namespace of the scenario on the
   * cluster of `KUBECONFIG` (ADR 0075). Every call for the same scenario uses the same namespace.
   */
  helm(chart: string): Helm;
  /**
   * One start of a slow system for the scenarios tagged `@shared=<name>` (ADR 0157): the first scenario of the group
   * in the test run calls `start` with a workspace of the group, whose `compose` and `helm` use the group's project
   * and namespace; every scenario of the group then gets that workspace and what `start` returned, as JSON. A failed
   * start fails each scenario of the group with its failure. The project and the namespace go down when the test run
   * ends, which needs the testkit's global setup (`testkit run` has it). A scenario without the tag cannot use it,
   * and a scenario with the tag fails when it does not.
   */
  shared<T>(name: string, start: (sut: SharedSut) => Promise<T>): Promise<Shared<T>>;
  /**
   * The module's input and output folders. Every path starts with `$INPUT/` or `$OUTPUT/` and stays inside that
   * folder; the module gets them as the environment variables `INPUT` and `OUTPUT`.
   */
  files: {
    /**
     * Writes the file, a text as UTF-8 or bytes as they are; `executable` lets the owner run it, like a plugin, and
     * `mode` gives it these permission bits, like 0o644 for a file that everyone may read.
     */
    put(path: string, content: string | Uint8Array, options?: { executable?: boolean; mode?: number }): Promise<void>;
    /** The permission bits of the file, like 0o600 for one that only its owner reads and writes, as `ls -l` shows them. */
    mode(path: string): Promise<number>;
    /**
     * Makes a symbolic link at `path` whose target is the text `target`, relative to the link's folder or absolute. A
     * link may point anywhere, as one in a repository that a module fetches can.
     */
    link(path: string, target: string): Promise<void>;
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

export interface SutHandle {
  sut: Sut;
  /** Stops every server, client and subscription the scenario started, and returns the connections NOREAL refused. */
  close(): Promise<string[]>;
  /** The names of the shared starts the scenario used. */
  sharedUsed(): string[];
}

/** The path of `$INPUT/...` or `$OUTPUT/...` in the folders; it refuses any other path. */
function insideOf(dirs: Folders): (path: string) => string {
  return (path) => {
    const [, name, rest = ""] = /^\$(INPUT|OUTPUT)(?:\/(.*))?$/s.exec(path) ?? [];
    const root = name === "INPUT" ? dirs.input : name === "OUTPUT" ? dirs.output : undefined;
    const full = root && resolve(root, rest);
    if (!root || !full || (full !== root && !full.startsWith(root + sep))) {
      throw new Error(`sut.files refuses a path outside $INPUT and $OUTPUT: ${path}`);
    }
    return full;
  };
}

/** `sut.files` on the folders. */
function makeFiles(dirs: Folders): Sut["files"] {
  const inside = insideOf(dirs);
  return {
    async put(path, content, options = {}) {
      const full = inside(path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
      if (options.executable) chmodSync(full, 0o755);
      if (options.mode !== undefined) chmodSync(full, options.mode);
    },
    async mode(path) {
      return statSync(inside(path)).mode & 0o777;
    },
    async link(path, target) {
      const full = inside(path);
      mkdirSync(dirname(full), { recursive: true });
      symlinkSync(target, full);
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
  };
}

export function makeSut(moduleRoot: string, dirs: Folders, hosts: () => string[] = () => [], scenario = ""): SutHandle {
  const launch = makeLaunch(moduleRoot, dirs, hosts, scenario);
  const stops: (() => Promise<unknown>)[] = [];
  const onStop = (stop: () => Promise<unknown>): void => {
    stops.push(stop);
  };
  const input = dirs.input;
  const inside = insideOf(dirs);
  // A shared start's system goes down when the test run ends (sharedDown); what this scenario starts on it, like a
  // port-forward, stops with the scenario.
  const shared = makeShared(moduleRoot, scenario, (workspace, create, owner, mark) => {
    const at = create ? folders(workspace) : foldersOf(workspace);
    return {
      files: makeFiles(at),
      compose: makeCompose(moduleRoot, at, () => mark("compose"), owner),
      helm: makeHelm(moduleRoot, at, onStop, () => mark("helm")),
    };
  });
  const http = makeHttp(launch, onStop);
  const site = makeSite(moduleRoot, onStop);
  const chromium = makeBrowser(() => site.base() ?? http.url(), moduleRoot, scenario, onStop);
  const sut: Sut = {
    async cli(args, options = {}) {
      const { command, argv, cwd, env } = launch(args, options.env);
      return run(command, argv, cwd, env, options.stdin);
    },
    action: makeAction(moduleRoot, dirs, launch),
    http,
    pages: makePages(() => http.url(), onStop),
    browser: chromium.browser,
    site: site.site,
    mcp: makeMcp(launch, onStop),
    acp: makeAcp(launch, onStop, inside),
    events: makeEvents(onStop),
    compose: makeCompose(moduleRoot, dirs, onStop),
    helm: makeHelm(moduleRoot, dirs, onStop),
    shared: shared.shared,
    files: makeFiles(dirs),
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
      const seen = chromium.problems();
      if (!existsSync(dirs.noreal)) return [...new Set(seen)];
      const refused = readFileSync(dirs.noreal, "utf8").split("\n").filter(Boolean);
      rmSync(dirs.noreal);
      return [...new Set([...refused, ...seen])];
    },
    sharedUsed: shared.used,
  };
}
