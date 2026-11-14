// The Stryker test runner of `osf mutation` for a unit whose system tests start its built bin (ADR 0061). The first
// run runs every scenario once with OSF_TESTKIT_MUTANTS, so each process of the module writes the mutants it ran
// into the folder of its scenario (testkit, support/coverage.js). Stryker then reruns, for each mutant, only the
// scenarios that ran it, and marks a mutant no scenario ran as NoCoverage. With the option `osfShard` ("i/n"), it
// tests only every n-th mutant (ADR 0066). Stryker loads this file by its path in each of its test runner processes,
// so it imports nothing but Node.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

interface Vitest {
  exitCode: number;
  output: string;
  timedOut: boolean;
}

/**
 * The Vitest config of a mutant's run, which the first run writes: the unit's own config, with a sequencer that runs
 * the scenario files with the shortest time of the first run first. A mutant's run stops at its first failure, and
 * most mutants are killed, so a short scenario that kills it saves the longer ones. Stryker starts its test runner
 * processes before the first run ends, so the config is a file in Stryker's temporary folder, which all of them read.
 */
const ORDER = join(".stryker-tmp", "osf-order");

function writeOrder(durations: Record<string, number>): void {
  const base = join(process.cwd(), "vitest.config.ts");
  if (!existsSync(base)) return;
  const dir = join(process.cwd(), ORDER);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "durations.json"), JSON.stringify(durations));
  const config = [
    'import { readFileSync } from "node:fs";',
    'import { mergeConfig } from "vitest/config";',
    `import base from ${JSON.stringify(pathToFileURL(base).href)};`,
    'const durations = JSON.parse(readFileSync(new URL("./durations.json", import.meta.url), "utf8"));',
    "const cost = (file) => durations[file] ?? Number.MAX_SAFE_INTEGER;",
    "class ShortestFirst {",
    "  async shard(files) { return files; }",
    "  async sort(files) { return [...files].sort((a, b) => cost(a.moduleId) - cost(b.moduleId)); }",
    "}",
    `export default mergeConfig(base, { root: ${JSON.stringify(process.cwd())}, test: { sequence: { sequencer: ShortestFirst } } });`,
    "",
  ].join("\n");
  writeFileSync(join(dir, "vitest.config.mjs"), config);
}

/** `--config` of the ordered config, once the first run wrote it. */
function orderArgs(): string[] {
  const config = join(process.cwd(), ORDER, "vitest.config.mjs");
  return existsSync(config) ? [`--config=${config}`] : [];
}

/** The output a run keeps: its end. A mutant that prints in a loop must not fill the memory of the runner. */
const OUTPUT_LIMIT = 64 * 1024;

/**
 * Vitest's own entry in the unit's folder. Node starts it directly: `pnpm exec` costs about 0.3 s more per mutant.
 */
function vitestEntry(): string {
  const manifest = createRequire(join(process.cwd(), "package.json")).resolve("vitest/package.json");
  return join(dirname(manifest), "vitest.mjs");
}

/**
 * Runs Vitest on the system tests in the unit's folder, all of them without `files`. Vitest runs in its own process
 * group, which is killed when it ends or when `timeoutMs` passes: a run that stops at its first failure (`--bail`)
 * leaves the module's servers of its other tests running, and over many mutants they fill the runner's memory.
 */
function vitest(entry: string, args: string[], env: Record<string, string>, timeoutMs?: number): Promise<Vitest> {
  const live = liveRun();
  const id = `${process.pid}-${++runs}`;
  return new Promise((done) => {
    const child = spawn(process.execPath, [entry, "run", ...args], {
      env: { ...process.env, ...env, OSF_TESTKIT_RUN: id },
      detached: true,
    });
    let output = "";
    const keep = (chunk: Buffer): void => {
      output += chunk;
      if (output.length > 2 * OUTPUT_LIMIT) output = output.slice(-OUTPUT_LIMIT);
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    let timedOut = false;
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            killGroup(child.pid);
          }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      killGroup(child.pid);
      removeContainers(id);
      live.end();
      done({ exitCode: code ?? 1, output: output.slice(-OUTPUT_LIMIT), timedOut });
    });
  });
}

/**
 * With OSF_MUTATION_RUNS (mutation-shard action), the start of this process's live run, in seconds, in a file named
 * by its process ID. The action removes a container that a module started only when it is older than every live run.
 */
function liveRun(): { end(): void } {
  const dir = process.env.OSF_MUTATION_RUNS;
  if (!dir) return { end() {} };
  const file = join(dir, String(process.pid));
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, String(Math.floor(Date.now() / 1000)));
  return { end: () => rmSync(file, { force: true }) };
}

let runs = 0;

/**
 * Removes the containers that the fakes of the run `id` started, by the label of OSF_TESTKIT_RUN (testkit). Every
 * process of a Stryker run shares one Ryuk, which removes them only when the last process ends: the forge of each
 * mutant's run stayed, until the runner had no free memory. It does not wait, and without Docker it does nothing.
 */
function removeContainers(id: string): void {
  const remove = spawn("sh", ["-c", removeCommand('"$1"'), "remove", id], { stdio: "ignore" });
  remove.on("error", () => {});
  remove.unref();
}

/** The shell command that removes the containers with the run label `id`, a shell word. */
export function removeCommand(id: string): string {
  return (
    `ids=$(docker ps --all --quiet --filter label=org.opensoftware.run=${id} 2>/dev/null); ` +
    '[ -z "$ids" ] || docker rm --force --volumes $ids >/dev/null 2>&1'
  );
}

/** Kills what is left of a process group; a group whose processes all ended is no error. */
function killGroup(pid: number | undefined): void {
  try {
    if (pid) process.kill(-pid, "SIGKILL");
  } catch {}
}

interface Report {
  testResults: {
    name: string;
    assertionResults: { title: string; status: string; duration?: number; failureMessages?: string[] }[];
  }[];
}

class ScenarioRunner {
  static inject = ["options"] as const;

  private readonly shard?: { index: number; count: number };
  private readonly workers: number;
  private readonly entry = vitestEntry();

  constructor(options: { osfShard?: string; osfWorkers?: number }) {
    const [index = 1, count = 1] = options.osfShard?.split("/").map(Number) ?? [];
    this.shard = options.osfShard ? { index, count } : undefined;
    this.workers = options.osfWorkers ?? 1;
  }

  capabilities() {
    return { reloadEnvironment: true };
  }

  async dryRun() {
    const temp = mkdtempSync(join(tmpdir(), "osf-mutants-"));
    try {
      const results = join(temp, "results.json");
      const mutants = join(temp, "mutants");
      const run = await vitest(this.entry, ["--reporter=json", `--outputFile=${results}`, ...journeyExcludes()], {
        OSF_TESTKIT_MUTANTS: mutants,
      });
      const report = JSON.parse(readFileSync(results, "utf8")) as Report;
      const tests = [];
      const perTest: Record<string, Record<string, number>> = {};
      const durations: Record<string, number> = {};
      for (const file of report.testResults) {
        const id = relative(process.cwd(), file.name);
        for (const test of file.assertionResults) {
          durations[file.name] = (durations[file.name] ?? 0) + (test.duration ?? 0);
          const failed = test.status !== "passed";
          // Status 0 is Success and 1 Failed in Stryker's TestStatus.
          // With the file, Stryker's incremental mode runs a test again when its file changed (ADR 0091).
          tests.push({
            id,
            name: test.title,
            fileName: file.name,
            timeSpentMs: test.duration ?? 0,
            status: failed ? 1 : 0,
            failureMessage: (test.failureMessages ?? []).join("\n").slice(0, 3000) || run.output,
          });
          perTest[id] = { ...perTest[id], ...ranBy(join(mutants, test.title)) };
        }
      }
      writeOrder(durations);
      return { status: "complete", tests, mutantCoverage: { static: {}, perTest } };
    } catch (error) {
      return { status: "error", errorMessage: String(error) };
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }

  async mutantRun(options: { activeMutant: { id: string }; testFilter?: string[]; timeout?: number }) {
    const files = options.testFilter ?? [];
    // A mutant of another shard passes without a test; osf mutation removes it from this shard's report.
    if (this.shard && Number(options.activeMutant.id) % this.shard.count !== this.shard.index - 1) {
      return { status: "survived", nrOfTests: 0 };
    }
    // The runner ends a run that passes the timeout itself, just before Stryker does: it kills the whole process
    // group, and Stryker then keeps this runner process instead of starting a new one.
    const limit = options.timeout === undefined ? undefined : Math.max(1_000, options.timeout - 1_000);
    const run = await vitest(
      this.entry,
      [...orderArgs(), "--bail=1", "--reporter=dot", `--maxWorkers=${this.workers}`, ...files],
      {
        __STRYKER_ACTIVE_MUTANT__: options.activeMutant.id,
      },
      limit,
    );
    if (run.timedOut) return { status: "timeout", reason: `no result within ${limit} ms` };
    if (run.exitCode === 0) return { status: "survived", nrOfTests: files.length };
    return { status: "killed", killedBy: files, failureMessage: run.output.slice(-2000), nrOfTests: files.length };
  }
}

/**
 * `--exclude` of the system test of each journey scenario (`@kind=journey`) of the unit's features (ADR 0131). The first
 * run leaves them out, so no mutant counts a journey as its test: each journey would start the module and Chromium
 * again for every mutant it reached, and page scenarios notice the server's code.
 */
export function journeyExcludes(root = process.cwd()): string[] {
  const features = join(root, "features");
  if (!existsSync(features)) return [];
  const ids: string[] = [];
  for (const entry of readdirSync(features, { recursive: true, encoding: "utf8" })) {
    if (!entry.endsWith(".feature")) continue;
    let tags = "";
    for (const line of readFileSync(join(features, entry), "utf8").split("\n")) {
      const text = line.trim();
      if (text.startsWith("@")) tags += ` ${text}`;
      else if (text !== "" && !text.startsWith("#")) {
        const id = /@id=(\S+)/.exec(tags)?.[1];
        if (id && /(?:^|\s)@kind=journey(?:\s|$)/.test(tags)) ids.push(id);
        tags = "";
      }
    }
  }
  return ids.map((id) => `--exclude=system-tests/${id}.test.ts`);
}

/** The mutants the processes of one scenario ran, as Stryker's coverage counts: one per mutant. */
function ranBy(folder: string): Record<string, number> {
  const ran: Record<string, number> = {};
  let files: string[] = [];
  try {
    files = readdirSync(folder);
  } catch {
    return ran;
  }
  for (const file of files) {
    for (const id of JSON.parse(readFileSync(join(folder, file), "utf8")) as string[]) ran[id] = 1;
  }
  return ran;
}

/** The option of `osf mutation` for this runner, so that Stryker accepts it. */
export const strykerValidationSchema = {
  properties: {
    osfShard: { type: "string", description: "Test only every n-th mutant: i/n (ADR 0066)." },
    osfWorkers: { type: "number", description: "Vitest workers of a mutant's run (ADR 0084)." },
  },
};

export const strykerPlugins = [{ kind: "TestRunner", name: "osf-scenarios", injectableClass: ScenarioRunner }];
