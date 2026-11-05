// RELEASE: every published package has the release files that `osf release-files` writes (lib/release.ts): its
// publish workflow as the template renders it, a release-please entry that names it, and its version in the
// manifest. No generated workflow or release entry is left for a package that is not published.
import type { Context } from "./lib/context.ts";
import {
  CONFIG,
  type Entry,
  entryOf,
  generatedWorkflows,
  MANIFEST,
  published,
  readJson,
  renderWorkflow,
  TEMPLATE,
  workflowOf,
} from "./lib/release.ts";
import { type Finding, lineOf } from "./lib/repo.ts";

const RUN = "run osf release-files";

export function release(context: Context): Finding[] {
  const { repo } = context;
  if (!repo.exists(CONFIG)) return [];
  const finding = (file: string, needle: string, message: string): Finding => ({
    check: "RELEASE",
    file,
    line: repo.exists(file) ? lineOf(repo.read(file), needle) : 1,
    message: `${message}: ${RUN}`,
  });
  const units = published(repo);
  const config = readJson<{ packages?: Record<string, Entry> }>(repo, CONFIG, {}).packages ?? {};
  const manifest = readJson<Record<string, string>>(repo, MANIFEST, {});
  const findings: Finding[] = [];
  for (const unit of units) {
    const workflow = workflowOf(unit);
    if (!repo.exists(workflow)) {
      findings.push(finding(`${unit.dir}/package.json`, '"name"', `${unit.name} has no ${workflow}`));
    } else if (repo.read(workflow) !== renderWorkflow(unit)) {
      findings.push(finding(workflow, "\n", `differs from ${TEMPLATE}`));
    }
    const entry = config[unit.dir];
    const wanted = entryOf(unit);
    if (!entry || Object.entries(wanted).some(([key, value]) => entry[key] !== value)) {
      findings.push(finding(CONFIG, `"${unit.dir}"`, `has no entry for ${unit.dir} with ${JSON.stringify(wanted)}`));
    }
    if (manifest[unit.dir] !== unit.version) {
      findings.push(finding(MANIFEST, `"${unit.dir}"`, `does not give ${unit.dir} its version ${unit.version}`));
    }
  }
  const dirs = new Set(units.map((unit) => unit.dir));
  const workflows = new Set(units.map(workflowOf));
  for (const file of generatedWorkflows(repo).filter((file) => !workflows.has(file))) {
    findings.push(finding(file, "\n", "publishes no published package of the workspace"));
  }
  for (const dir of [...Object.keys(config), ...Object.keys(manifest)].filter((dir) => !dirs.has(dir))) {
    findings.push(finding(dir in config ? CONFIG : MANIFEST, `"${dir}"`, `${dir} is no published package`));
  }
  return findings;
}
