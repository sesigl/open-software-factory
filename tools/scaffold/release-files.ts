// `osf release-files`: writes the release files of every published package (lib/release.ts) and removes those of
// packages that are no longer published. RELEASE fails until they are current.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CONFIG,
  type Entry,
  entryOf,
  generatedWorkflows,
  MANIFEST,
  newEntryOf,
  published,
  readJson,
  renderWorkflow,
  workflowOf,
} from "../checks/lib/release.ts";
import { Repo } from "../checks/lib/repo.ts";

export function releaseFiles(root: string): number {
  const repo = new Repo(root);
  const units = published(repo);
  const write = (file: string, text: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  const wanted = new Set(units.map(workflowOf));
  for (const unit of units) write(workflowOf(unit), renderWorkflow(unit));
  for (const file of generatedWorkflows(repo).filter((file) => !wanted.has(file))) rmSync(join(root, file));

  const config = readJson<{ packages?: Record<string, Entry> }>(repo, CONFIG, {});
  const manifest = readJson<Record<string, string>>(repo, MANIFEST, {});
  const dirs = new Set(units.map((unit) => unit.dir));
  // Existing entries keep their order and their other keys; new packages come last; others go.
  const packages = Object.fromEntries(Object.entries(config.packages ?? {}).filter(([dir]) => dirs.has(dir)));
  const versions = Object.fromEntries(Object.entries(manifest).filter(([dir]) => dirs.has(dir)));
  for (const unit of units) {
    const old = packages[unit.dir];
    packages[unit.dir] = old ? { ...old, ...entryOf(unit) } : newEntryOf(unit);
    versions[unit.dir] = unit.version;
  }
  write(CONFIG, `${JSON.stringify({ ...config, packages }, null, 2)}\n`);
  write(MANIFEST, `${JSON.stringify(versions, null, 2)}\n`);
  return 0;
}
