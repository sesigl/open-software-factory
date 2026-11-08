// `osf mutation <unit>`: Stryker on the source lines of one module that changed since OSF_BASE, or on every line
// with --all (ADR 0037). The module's `mutation` script calls it; `osf check MUTATION` scores the report.
// `--shard i/n` mutates the same lines in each of n runners, and each runner tests every n-th of their mutants
// (ADR 0066), so that n runners share a large change. `--incremental <file>` reuses the results of the mutants in that
// earlier report whose code and tests did not change (Stryker's incremental mode, ADR 0091).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { availableParallelism } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addedLines, baseCommit, changedFiles } from "../checks/lib/git.ts";
import { Repo } from "../checks/lib/repo.ts";
import { mutatedUnits, mutationReport } from "../checks/quality.ts";
import { removeCommand } from "./mutation-runner.ts";

export async function mutation(root: string, args: string[]): Promise<number> {
  const path = args.find((arg) => !arg.startsWith("--"));
  if (!path) return fail("Give a module folder: osf mutation <folder> [--all] [--list] [--shard i/n]");
  const shard = shardOf(args);
  if (typeof shard === "string") return fail(shard);
  const given = flagValue(args, "--incremental");
  const incremental = given === undefined ? undefined : resolve(given);
  const unit = relative(root, resolve(path)).split("\\").join("/");
  const repo = new Repo(root);
  const files = mutatedUnits(repo).get(unit);
  if (!files) return fail(`${unit} is no module with source files in src/ or bin/`);

  const mutate = mutatedRanges(repo, files, args.includes("--all"));
  if (typeof mutate === "string") return fail(mutate);
  const local = mutate.map((entry) => entry.slice(unit.length + 1));
  if (args.includes("--list")) {
    for (const entry of local) process.stdout.write(`${entry}\n`);
    return 0;
  }
  if (local.length === 0) {
    process.stdout.write(`MUTATION ${unit}: no changed lines in its source files, nothing to mutate\n`);
    return 0;
  }

  const cwd = join(root, unit);
  const report = join(root, mutationReport(unit, shard?.index));
  const settings = (JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as { osf?: Settings }).osf ?? {};
  // Stryker builds the module from the mutated files and starts its system tests once per mutant. The tests start
  // the built artifact, which reads the active mutant from __STRYKER_ACTIVE_MUTANT__ (the testkit passes it on).
  // In place, because the module's tsconfig files extend the repository's.
  const { Stryker } = await import("@stryker-mutator/core");
  const stryker = new Stryker({
    mutate: local,
    inPlace: true,
    ...runner(cwd, unit, shard, settings),
    buildCommand: "pnpm run build",
    // Only the sources: tsc builds them with the instrumented code, which does not type-check.
    disableTypeChecks: "src/**/*.ts",
    // One mutant per CPU, each in one Vitest worker: the CPUs then test different mutants, and none of them runs the
    // rest of a mutant's scenarios after the first one failed. A unit whose scenarios start heavy services, such as
    // Temporal, sets fewer in osf.mutationConcurrency (ADR 0084).
    concurrency: Number(settings.mutationConcurrency) || availableParallelism(),
    reporters: ["json", "progress-append-only"],
    jsonReporter: { fileName: report },
    // Stryker reads the file, and at the end writes this run's report into it.
    ...(incremental && { incremental: true, incrementalFile: incremental }),
    tempDirName: ".stryker-tmp",
    cleanTempDir: "always",
    allowEmpty: true,
  });
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    await stryker.runMutationTest();
    if (shard) keepOwnMutants(report, shard);
    if (shard && incremental && existsSync(incremental)) keepOwnMutants(incremental, shard);
  } finally {
    process.chdir(previous);
    // Stryker restores the source files but leaves the build of the last mutated source: build again, except on CI,
    // where the runner ends after this.
    if (!process.env.CI) spawnSync("pnpm", ["run", "build"], { cwd, stdio: "inherit" });
  }
  return 0;
}

/**
 * How Stryker runs the tests of a mutant (ADR 0061). The tests of a module or an adapter reach its code only in the
 * processes of its built bin, which record the mutants they ran: each mutant reruns only the scenarios that ran it.
 * A library's tests run its code in the test process, which records nothing: each mutant reruns all its tests.
 */
interface Settings {
  mutationConcurrency?: number;
  mutationWorkers?: number;
}

function runner(cwd: string, unit: string, shard: Shard | undefined, settings: Settings): Record<string, unknown> {
  if (unit.startsWith("packages/")) {
    // Node starts Vitest's entry directly: `pnpm exec` costs about 0.3 s more per mutant.
    const vitest = join(dirname(createRequire(join(cwd, "package.json")).resolve("vitest/package.json")), "vitest.mjs");
    // The first run has no active mutant and runs the tests; a mutant of another shard passes without a test.
    const skip = shard
      ? `[ -n "$__STRYKER_ACTIVE_MUTANT__" ] && [ $(($__STRYKER_ACTIVE_MUTANT__ % ${shard.count})) -ne ${shard.index - 1} ] || `
      : "";
    // Each run labels the containers of its fakes and removes them when it ends (mutation-runner.ts).
    const run = `export OSF_TESTKIT_RUN="library-$$"; node "${vitest}" run --bail=1 --reporter=dot; status=$?`;
    return {
      testRunner: "command",
      commandRunner: { command: `${skip}{ ${run}; ${removeCommand('"$OSF_TESTKIT_RUN"')}; exit $status; }` },
      coverageAnalysis: "off",
    };
  }
  return {
    plugins: [fileURLToPath(new URL("mutation-runner.ts", import.meta.url))],
    testRunner: "osf-scenarios",
    // The runner tests only the mutants of this shard (mutation-runner.ts).
    osfShard: shard && `${shard.index}/${shard.count}`,
    // Vitest workers of a mutant's run; more only for a unit whose scenarios mostly wait (osf.mutationWorkers).
    osfWorkers: Number(settings.mutationWorkers) || 1,
    coverageAnalysis: "perTest",
    // A mutant's run starts Vitest for a few scenarios; their time in the first run leaves out that start.
    timeoutMS: 60_000,
    // A mutant that survives reruns all its scenarios in one worker, while the other workers load the CPUs: with
    // Stryker's factor of 1.5 over the first run's time, some of them ended as Timeout, which counts as detected.
    timeoutFactor: 2.5,
    // The first run starts every scenario of the unit once; foreman's take more than Stryker's default of 5 minutes.
    dryRunTimeoutMinutes: 30,
  };
}

interface Shard {
  index: number;
  count: number;
}

/** The value after the flag, undefined without the flag. */
function flagValue(args: string[], flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at < 0 ? undefined : args[at + 1];
}

/** The value of `--shard i/n`, undefined without it, or the reason it is wrong. */
function shardOf(args: string[]): Shard | undefined | string {
  const at = args.indexOf("--shard");
  if (at < 0) return undefined;
  const [, index = 0, count = 0] = /^(\d+)\/(\d+)$/.exec(args[at + 1] ?? "")?.map(Number) ?? [];
  if (index < 1 || index > count) return "--shard takes i/n with 1 <= i <= n, such as --shard 2/4";
  return { index, count };
}

/**
 * Whether a mutant belongs to the shard. Every shard instruments the same lines, so Stryker numbers their mutants the
 * same way in each, in the order of the source: dealing them out by number spreads a costly file over all shards.
 */
function ownMutant(id: string, shard: Shard): boolean {
  return Number(id) % shard.count === shard.index - 1;
}

/** Removes the mutants of the other shards from the report: their runs passed without a test. */
function keepOwnMutants(report: string, shard: Shard): void {
  const json = JSON.parse(readFileSync(report, "utf8")) as { files?: Record<string, { mutants?: { id: string }[] }> };
  for (const file of Object.values(json.files ?? {})) {
    file.mutants = (file.mutants ?? []).filter((mutant) => ownMutant(mutant.id, shard));
  }
  writeFileSync(report, JSON.stringify(json));
}

/** What Stryker mutates in a unit's files: each source file whole, or `file:start-end` of each run of added lines. */
export function mutatedRanges(repo: Repo, files: string[], all: boolean): string[] | string {
  return all ? allLines(files) : changedLines(repo, files);
}

/** Each TypeScript source file whole. */
function allLines(files: string[]): string[] {
  return files.filter((file) => file.endsWith(".ts"));
}

/** `file:start-end` for each run of lines the change adds to a TypeScript source file since OSF_BASE. */
function changedLines(repo: Repo, files: string[]): string[] | string {
  const base = baseCommit(repo.root);
  if (!base) return "osf mutation needs OSF_BASE to find the changed lines, or --all to mutate every line";
  const changed = new Set(changedFiles(repo.root, base));
  const lines = allLines(files)
    .filter((file) => changed.has(file))
    .flatMap((file) => addedLines(repo.root, base, file).map((line) => ({ file, line })));
  const out: string[] = [];
  let run: { file: string; start: number; end: number } | undefined;
  for (const { file, line } of lines) {
    if (run?.file === file && line === run.end + 1) {
      run.end = line;
      continue;
    }
    if (run) out.push(`${run.file}:${run.start}-${run.end}`);
    run = { file, start: line, end: line };
  }
  if (run) out.push(`${run.file}:${run.start}-${run.end}`);
  return out;
}

function fail(message: string): number {
  process.stderr.write(`${message}\n`);
  return 2;
}
