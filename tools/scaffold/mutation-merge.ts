// `osf mutation-merge <plan> <folder>`: the mutant results of a pull request's mutation run for its next push
// (ADR 0091). For each unit of the plan (`osf mutation-plan --keys`) whose shards all left a report in
// reports/mutation/, it joins their mutants into `<folder>/<unit>.<guard>.json` and removes the unit's files of other
// guards. A unit with a missing shard keeps its earlier file. `osf mutation --incremental` reads the file.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mutationReport } from "../checks/quality.ts";

interface PlannedShard {
  folder: string;
  shard: string;
  guard?: string;
}

interface Report {
  files?: Record<string, { mutants?: unknown[] }>;
}

/** The file of a unit's mutant results for a guard. */
export function incrementalFile(folder: string, unit: string, guard: string): string {
  return join(folder, `${unit.replaceAll("/", "-")}.${guard}.json`);
}

export function mutationMerge(root: string, args: string[]): number {
  const [planFile, out] = args;
  if (!planFile || !out) {
    process.stderr.write("Give the plan and a folder: osf mutation-merge <plan.json> <folder>\n");
    return 2;
  }
  const plan = JSON.parse(readFileSync(planFile, "utf8")) as PlannedShard[];
  const units = new Map<string, { count: number; guard?: string }>();
  for (const { folder, shard, guard } of plan) units.set(folder, { count: Number(shard.split("/")[1]), guard });
  mkdirSync(out, { recursive: true });
  for (const [unit, { count, guard }] of units) {
    if (!guard) continue;
    const reports = Array.from({ length: count }, (_, index) => join(root, mutationReport(unit, index + 1)));
    if (!reports.every((report) => existsSync(report))) {
      process.stdout.write(`${unit}: a shard has no report, the earlier results stay\n`);
      continue;
    }
    const [first, ...rest] = reports.map((report) => JSON.parse(readFileSync(report, "utf8")) as Report);
    const files = structuredClone(first?.files ?? {});
    const merged: Report = { ...first, files };
    for (const report of rest) {
      for (const [path, file] of Object.entries(report.files ?? {})) {
        const into = files[path];
        if (into) into.mutants = [...(into.mutants ?? []), ...(file.mutants ?? [])];
        else files[path] = file;
      }
    }
    const prefix = `${unit.replaceAll("/", "-")}.`;
    for (const name of readdirSync(out)) {
      if (name.startsWith(prefix) && /^[0-9a-f]+\.json$/.test(name.slice(prefix.length))) rmSync(join(out, name));
    }
    writeFileSync(incrementalFile(out, unit, guard), JSON.stringify(merged));
    const mutants = Object.values(files).reduce((sum, file) => sum + (file.mutants?.length ?? 0), 0);
    process.stdout.write(`${unit}: ${mutants} mutant results for the next push\n`);
  }
  return 0;
}
