// `osf mutation <unit>`: Stryker on the source lines of one module that changed since OSF_BASE, or on every line
// with --all (ADR 0037). The module's `mutation` script calls it; `osf check MUTATION` scores the report.
// `--shard i/n` mutates the same lines in each of n runners, and each runner tests every n-th of their mutants
// (ADR 0065), so that n runners share a large change.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addedLines, baseCommit, changedFiles } from "../checks/lib/git.ts";
import { Repo } from "../checks/lib/repo.ts";
import { mutatedUnits, mutationReport } from "../checks/quality.ts";

export async function mutation(root: string, args: string[]): Promise<number> {
  const path = args.find((arg) => !arg.startsWith("--"));
  if (!path) return fail("Give a module folder: osf mutation <folder> [--all] [--list] [--shard i/n]");
  const shard = shardOf(args);
  if (typeof shard === "string") return fail(shard);
  const unit = relative(root, resolve(path)).split("\\").join("/");
  const repo = new Repo(root);
  const files = mutatedUnits(repo).get(unit);
  if (!files) return fail(`${unit} is no module with source files in src/ or bin/`);

  const mutate = args.includes("--all") ? allLines(files) : changedLines(repo, files);
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
  // Stryker builds the module from the mutated files and starts its system tests once per mutant. The tests start
  // the built artifact, which reads the active mutant from __STRYKER_ACTIVE_MUTANT__ (the testkit passes it on).
  // In place, because the module's tsconfig files extend the repository's.
  const { Stryker } = await import("@stryker-mutator/core");
  const stryker = new Stryker({
    mutate: local,
    inPlace: true,
    ...runner(unit, shard),
    buildCommand: "pnpm run build",
    // Only the sources: tsc builds them with the instrumented code, which does not type-check.
    disableTypeChecks: "src/**/*.ts",
    concurrency: Math.max(1, Math.floor(availableParallelism() / 2)),
    reporters: ["json", "progress-append-only"],
    jsonReporter: { fileName: report },
    tempDirName: ".stryker-tmp",
    cleanTempDir: "always",
    allowEmpty: true,
  });
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    await stryker.runMutationTest();
    if (shard) keepOwnMutants(report, shard);
  } finally {
    process.chdir(previous);
    // Stryker restores the source files but leaves the build of the last mutated source: build again.
    spawnSync("pnpm", ["run", "build"], { cwd, stdio: "inherit" });
  }
  return 0;
}

/**
 * How Stryker runs the tests of a mutant (ADR 0061). The tests of a module or an adapter reach its code only in the
 * processes of its built bin, which record the mutants they ran: each mutant reruns only the scenarios that ran it.
 * A library's tests run its code in the test process, which records nothing: each mutant reruns all its tests.
 */
function runner(unit: string, shard: Shard | undefined): Record<string, unknown> {
  if (unit.startsWith("packages/")) {
    // The first run has no active mutant and runs the tests; a mutant of another shard passes without a test.
    const skip = shard
      ? `[ -n "$__STRYKER_ACTIVE_MUTANT__" ] && [ $(($__STRYKER_ACTIVE_MUTANT__ % ${shard.count})) -ne ${shard.index - 1} ] || `
      : "";
    return {
      testRunner: "command",
      commandRunner: { command: `${skip}pnpm exec vitest run --bail=1 --reporter=dot` },
      coverageAnalysis: "off",
    };
  }
  return {
    plugins: [fileURLToPath(new URL("mutation-runner.ts", import.meta.url))],
    testRunner: "osf-scenarios",
    // The runner tests only the mutants of this shard (mutation-runner.ts).
    osfShard: shard && `${shard.index}/${shard.count}`,
    coverageAnalysis: "perTest",
    // A mutant's run starts Vitest for a few scenarios; their time in the first run leaves out that start.
    timeoutMS: 60_000,
  };
}

interface Shard {
  index: number;
  count: number;
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
