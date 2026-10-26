// The Stryker test runner of `osf mutation` for a unit whose system tests start its built bin (ADR 0061). The first
// run runs every scenario once with OSF_TESTKIT_MUTANTS, so each process of the module writes the mutants it ran
// into the folder of its scenario (testkit, support/coverage.ts). Stryker then reruns, for each mutant, only the
// scenarios that ran it, and marks a mutant no scenario ran as NoCoverage. With the option `osfShard` ("i/n"), it
// tests only every n-th mutant (ADR 0066). Stryker loads this file by its path in each of its test runner processes,
// so it imports nothing but Node.
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

interface Vitest {
  exitCode: number;
  output: string;
}

/**
 * Runs Vitest on the system tests in the unit's folder, all of them without `files`. Vitest runs in its own process
 * group, which is killed when it ends: a run that stops at its first failure (`--bail`) leaves the module's servers of
 * its other tests running, and over many mutants they fill the runner's memory.
 */
function vitest(args: string[], env: Record<string, string>): Promise<Vitest> {
  return new Promise((done) => {
    const child = spawn("pnpm", ["exec", "vitest", "run", ...args], {
      env: { ...process.env, ...env },
      detached: true,
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("close", (code) => {
      killGroup(child.pid);
      done({ exitCode: code ?? 1, output });
    });
  });
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

  constructor(options: { osfShard?: string }) {
    const [index = 1, count = 1] = options.osfShard?.split("/").map(Number) ?? [];
    this.shard = options.osfShard ? { index, count } : undefined;
  }

  capabilities() {
    return { reloadEnvironment: true };
  }

  async dryRun() {
    const temp = mkdtempSync(join(tmpdir(), "osf-mutants-"));
    try {
      const results = join(temp, "results.json");
      const mutants = join(temp, "mutants");
      const run = await vitest(["--reporter=json", `--outputFile=${results}`], { OSF_TESTKIT_MUTANTS: mutants });
      const report = JSON.parse(readFileSync(results, "utf8")) as Report;
      const tests = [];
      const perTest: Record<string, Record<string, number>> = {};
      for (const file of report.testResults) {
        const id = relative(process.cwd(), file.name);
        for (const test of file.assertionResults) {
          const failed = test.status !== "passed";
          // Status 0 is Success and 1 Failed in Stryker's TestStatus.
          tests.push({
            id,
            name: test.title,
            timeSpentMs: test.duration ?? 0,
            status: failed ? 1 : 0,
            failureMessage: (test.failureMessages ?? []).join("\n").slice(0, 3000) || run.output,
          });
          perTest[id] = { ...perTest[id], ...ranBy(join(mutants, test.title)) };
        }
      }
      return { status: "complete", tests, mutantCoverage: { static: {}, perTest } };
    } catch (error) {
      return { status: "error", errorMessage: String(error) };
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }

  async mutantRun(options: { activeMutant: { id: string }; testFilter?: string[] }) {
    const files = options.testFilter ?? [];
    // A mutant of another shard passes without a test; osf mutation removes it from this shard's report.
    if (this.shard && Number(options.activeMutant.id) % this.shard.count !== this.shard.index - 1) {
      return { status: "survived", nrOfTests: 0 };
    }
    const run = await vitest(["--bail=1", "--reporter=dot", ...files], {
      __STRYKER_ACTIVE_MUTANT__: options.activeMutant.id,
    });
    if (run.exitCode === 0) return { status: "survived", nrOfTests: files.length };
    return { status: "killed", killedBy: files, failureMessage: run.output.slice(-2000), nrOfTests: files.length };
  }
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
  properties: { osfShard: { type: "string", description: "Test only every n-th mutant: i/n (ADR 0066)." } },
};

export const strykerPlugins = [{ kind: "TestRunner", name: "osf-scenarios", injectableClass: ScenarioRunner }];
