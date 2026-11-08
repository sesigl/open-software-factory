// `osf mutation-plan [--all]`: the shards of a mutation run as JSON, one runner each (ADR 0066, ADR 0084). Without
// --all, the units whose source lines a change adds since OSF_BASE, cut by the added lines (mutation.yml); with --all,
// every unit with a mutation script, cut by all its lines (nightly.yml). A new unit joins both runs without a change
// in a workflow. With --keys, each shard also has the `key` of its report and the `guard` of its unit's mutant results
// and the file name of those `results` (mutation-keys.ts, ADR 0091).
import { addedLines, baseCommit, changedFiles } from "../checks/lib/git.ts";
import { Repo } from "../checks/lib/repo.ts";
import { mutatedUnits } from "../checks/quality.ts";
import { mutatedRanges } from "./mutation.ts";
import { type KeyedUnit, mutationKeys } from "./mutation-keys.ts";
import { incrementalFile } from "./mutation-merge.ts";

/** Changed lines one runner mutates on a pull request, unless the package.json sets `osf.mutationLinesPerShard`. */
const CHANGED_LINES_PER_SHARD = 100;
/**
 * Lines one runner mutates in about 15 to 20 minutes in the nightly run, unless the package.json sets
 * `osf.mutationAllLinesPerShard`: a unit whose scenarios start slow services sets fewer.
 */
const ALL_LINES_PER_SHARD = 600;
const MAX_SHARDS = { changed: 10, all: 20 };

interface Shard {
  package: string;
  folder: string;
  shard: string;
  key?: string;
  guard?: string;
  /** The file name of the unit's mutant results for its guard (osf mutation-merge). */
  results?: string;
}

interface Manifest {
  name: string;
  scripts?: Record<string, string>;
  osf?: { mutationLinesPerShard?: number; mutationAllLinesPerShard?: number };
}

export function mutationPlan(root: string, args: string[]): number {
  const repo = new Repo(root);
  const all = args.includes("--all");
  const base = all ? undefined : baseCommit(root);
  if (!all && !base) {
    process.stderr.write("osf mutation-plan needs OSF_BASE to find the changed lines, or --all for every line\n");
    return 2;
  }
  const changed = base ? new Set(changedFiles(root, base)) : undefined;
  const plan: (Shard & { perShard: number })[] = [];
  const keyed: KeyedUnit[] = [];
  for (const [folder, files] of [...mutatedUnits(repo)].sort(([a], [b]) => a.localeCompare(b))) {
    const manifest = JSON.parse(repo.read(`${folder}/package.json`)) as Manifest;
    if (!manifest.scripts?.mutation) continue;
    const sources = files.filter((file) => file.endsWith(".ts"));
    const lines = base
      ? sources.filter((file) => changed?.has(file)).reduce((sum, file) => sum + addedLines(root, base, file).length, 0)
      : sources.reduce((sum, file) => sum + lineCount(repo.read(file)), 0);
    if (lines === 0) continue;
    const perShard = base
      ? Number(manifest.osf?.mutationLinesPerShard) || CHANGED_LINES_PER_SHARD
      : Number(manifest.osf?.mutationAllLinesPerShard) || ALL_LINES_PER_SHARD;
    const max = base ? MAX_SHARDS.changed : MAX_SHARDS.all;
    const count = Math.min(max, Math.ceil(lines / perShard));
    if (count < Math.ceil(lines / perShard)) {
      process.stderr.write(
        `osf mutation-plan: ${manifest.name} has more lines than ${max} shards of ${perShard} hold\n`,
      );
    }
    const ranges = mutatedRanges(repo, files, all);
    keyed.push({ package: manifest.name, folder, sources, ranges: typeof ranges === "string" ? [] : ranges });
    for (let index = 1; index <= count; index++) {
      plan.push({ package: manifest.name, folder, shard: `${index}/${count}`, perShard });
    }
  }
  // The units with the fewest lines per shard cost the most per line: their shards start first, so the run does not
  // wait for one of them at its end.
  const ordered: Shard[] = plan.sort((a, b) => a.perShard - b.perShard).map(({ perShard: _, ...shard }) => shard);
  if (args.includes("--keys")) {
    const keys = mutationKeys(root, keyed);
    if (typeof keys === "string") {
      process.stderr.write(`osf mutation-plan: ${keys}\n`);
      return 2;
    }
    for (const shard of ordered) {
      const unit = keys.get(shard.package);
      shard.key = `${shard.folder.replaceAll("/", "-")}-${shard.shard.replace("/", "-of-")}-${unit?.key}`;
      shard.guard = unit?.guard;
      shard.results = unit && incrementalFile("", shard.folder, unit.guard);
    }
  }
  process.stdout.write(`${JSON.stringify(ordered)}\n`);
  return 0;
}

function lineCount(text: string): number {
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}
