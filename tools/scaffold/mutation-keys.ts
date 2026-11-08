// The keys of a mutation run on a pull request (ADR 0091), from one `turbo run mutation --dry=json` for all units:
// - `key`: a shard's report is the same when the unit's mutation task has the same turbo hash and the change adds the
//   same line ranges. mutation.yml reuses the report of an earlier push for that key.
// - `guard`: the results of single mutants are reusable (Stryker's incremental mode) only while everything a test
//   reads, except what Stryker compares itself, stays the same. Stryker compares the mutated source files and, for the
//   scenario runner, the test files. The guard is a hash of the rest: turbo's global inputs, the unit's external
//   dependencies, the build hashes of the packages it depends on and the unit's other input files.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { posix } from "node:path";

export interface UnitKeys {
  /** A hash of the unit's mutation task and its changed line ranges. */
  key: string;
  /** A hash of what the unit's tests read beyond the files that Stryker compares. */
  guard: string;
}

export interface KeyedUnit {
  package: string;
  folder: string;
  /** Every TypeScript source file of the unit, relative to the repository. */
  sources: string[];
  /** The line ranges that Stryker mutates, as `osf mutation --list` prints them. */
  ranges: string[];
}

interface DryRun {
  globalCacheInputs: unknown;
  tasks: {
    taskId: string;
    hash: string;
    hashOfExternalDependencies: string;
    dependencies: string[];
    inputs: Record<string, string>;
  }[];
}

/** The keys of each unit by package name, or the reason turbo gave none. */
export function mutationKeys(root: string, units: KeyedUnit[]): Map<string, UnitKeys> | string {
  if (units.length === 0) return new Map();
  const turbo = createRequire(import.meta.url).resolve("turbo/bin/turbo");
  const filters = units.map((unit) => `--filter=${unit.package}`);
  const run = spawnSync(process.execPath, [turbo, "run", "mutation", "--dry=json", ...filters], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (run.status !== 0) return `turbo run mutation --dry=json failed: ${run.stderr.trim().split("\n").at(-1)}`;
  const dry = JSON.parse(run.stdout) as DryRun;
  const hashes = new Map(dry.tasks.map((task) => [task.taskId, task.hash]));
  const keys = new Map<string, UnitKeys>();
  for (const unit of units) {
    const task = dry.tasks.find((each) => each.taskId === `${unit.package}#mutation`);
    if (!task) return `turbo has no task ${unit.package}#mutation`;
    const compared = new Set(unit.sources.map((file) => posix.relative(unit.folder, file)));
    // The command runner of a library reports no test files to Stryker, so their changes stay in the guard.
    const library = unit.folder.startsWith("packages/");
    const rest = Object.entries(task.inputs)
      .filter(([file]) => !compared.has(file) && (library || !/^system-tests\/.*\.test\.ts$/.test(file)))
      .sort(([a], [b]) => a.localeCompare(b));
    const dependencies = [...new Set(task.dependencies)].sort().map((id) => `${id} ${hashes.get(id)}`);
    keys.set(unit.package, {
      key: sha([task.hash, ...unit.ranges]),
      guard: sha([
        JSON.stringify(dry.globalCacheInputs),
        task.hashOfExternalDependencies,
        ...dependencies,
        ...rest.map(([file, hash]) => `${file} ${hash}`),
      ]),
    });
  }
  return keys;
}

function sha(lines: string[]): string {
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 32);
}
