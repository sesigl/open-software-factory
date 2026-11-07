// `osf mutation-plan [--all]`: the shards of a mutation run as JSON, one runner each (ADR 0066, ADR 0084). Without
// --all, the units whose source lines a change adds since OSF_BASE, cut by the added lines (mutation.yml); with --all,
// every unit with a mutation script, cut by all its lines (nightly.yml). A new unit joins both runs without a change
// in a workflow.
import { addedLines, baseCommit, changedFiles } from "../checks/lib/git.ts";
import { Repo } from "../checks/lib/repo.ts";
import { mutatedUnits } from "../checks/quality.ts";

/** Changed lines one runner mutates on a pull request, unless the package.json sets `osf.mutationLinesPerShard`. */
const CHANGED_LINES_PER_SHARD = 100;
/** Lines one runner mutates in the nightly run, unless the package.json sets `osf.mutationAllLinesPerShard`. */
const ALL_LINES_PER_SHARD = 300;
const MAX_SHARDS = { changed: 10, all: 20 };

interface Shard {
  package: string;
  folder: string;
  shard: string;
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
  const plan: Shard[] = [];
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
    const count = Math.min(base ? MAX_SHARDS.changed : MAX_SHARDS.all, Math.ceil(lines / perShard));
    for (let index = 1; index <= count; index++) {
      plan.push({ package: manifest.name, folder, shard: `${index}/${count}` });
    }
  }
  process.stdout.write(`${JSON.stringify(plan)}\n`);
  return 0;
}

function lineCount(text: string): number {
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}
