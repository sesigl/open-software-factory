// `osf mutation <unit>`: Stryker on the source lines of one module that changed since OSF_BASE, or on every line
// with --all (ADR 0035). The module's `mutation` script calls it; `osf check MUTATION` scores the report.
import { spawnSync } from "node:child_process";
import { availableParallelism } from "node:os";
import { join, relative, resolve } from "node:path";
import { addedLines, baseCommit, changedFiles } from "../checks/lib/git.ts";
import { Repo } from "../checks/lib/repo.ts";
import { mutatedUnits, mutationReport } from "../checks/quality.ts";

export async function mutation(root: string, args: string[]): Promise<number> {
  const path = args.find((arg) => !arg.startsWith("--"));
  if (!path) return fail("Give a module folder: osf mutation <folder> [--all] [--list]");
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
  // Stryker builds the module from the mutated files and starts its system tests once per mutant. The tests start
  // the built artifact, which reads the active mutant from __STRYKER_ACTIVE_MUTANT__ (the testkit passes it on).
  // In place, because the module's tsconfig files extend the repository's.
  const { Stryker } = await import("@stryker-mutator/core");
  const stryker = new Stryker({
    mutate: local,
    inPlace: true,
    testRunner: "command",
    commandRunner: { command: "pnpm exec vitest run --bail=1 --reporter=dot" },
    buildCommand: "pnpm run build",
    coverageAnalysis: "off",
    // Only the sources: tsc builds them with the instrumented code, which does not type-check.
    disableTypeChecks: "src/**/*.ts",
    concurrency: Math.max(1, Math.floor(availableParallelism() / 2)),
    reporters: ["json", "progress-append-only"],
    jsonReporter: { fileName: join(root, mutationReport(unit)) },
    tempDirName: ".stryker-tmp",
    cleanTempDir: "always",
    allowEmpty: true,
  });
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    await stryker.runMutationTest();
  } finally {
    process.chdir(previous);
    // Stryker restores the source files but leaves the build of the last mutated source: build again.
    spawnSync("pnpm", ["run", "build"], { cwd, stdio: "inherit" });
  }
  return 0;
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
  const out: string[] = [];
  for (const file of allLines(files)) {
    if (!changed.has(file)) continue;
    let start = 0;
    let end = 0;
    for (const line of [...addedLines(repo.root, base, file), Number.POSITIVE_INFINITY]) {
      if (start > 0 && line === end + 1) {
        end = line;
        continue;
      }
      if (start > 0) out.push(`${file}:${start}-${end}`);
      start = line;
      end = line;
    }
  }
  return out;
}

function fail(message: string): number {
  process.stderr.write(`${message}\n`);
  return 2;
}
