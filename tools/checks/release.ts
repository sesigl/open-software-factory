// RELEASE: every published package has the release files that `osf release-files` writes (lib/release.ts): its
// publish workflow as the template renders it, a release-please entry that names it, and its version in the
// manifest. No generated workflow or release entry is left for a package that is not published. The release pull
// request gets every required status: release-please.yml starts each workflow that reports one (ADR 0174).
import { parse } from "yaml";
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
import { type Finding, lineOf, type Repo } from "./lib/repo.ts";

const RUN = "run osf release-files";
const RELEASE_PLEASE = ".github/workflows/release-please.yml";
/**
 * The workflows that report the required statuses of a pull request, and those statuses. GITHUB_TOKEN opens the
 * release pull request, and its events start no workflow, so release-please.yml starts each one with
 * workflow_dispatch (ADR 0174).
 */
const DISPATCHED: Record<string, string> = {
  "verify.yml": "the required statuses verify and proof",
  "gatekeeper.yml": "the required status gatekeeper",
};

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
  return [...findings, ...dispatches(repo)];
}

type Dispatchable = { on?: { workflow_dispatch?: { inputs?: Record<string, unknown> } } } | null;

/** release-please.yml starts each workflow of DISPATCHED from main with the input pr, which each workflow takes. */
function dispatches(repo: Repo): Finding[] {
  if (!repo.exists(RELEASE_PLEASE)) return [];
  const text = repo.read(RELEASE_PLEASE);
  const findings: Finding[] = [];
  for (const [file, statuses] of Object.entries(DISPATCHED)) {
    const start = `gh workflow run ${file}`;
    const lines = text.split("\n").filter((line) => line.includes(start));
    if (!lines.some((line) => /--ref main(\s|$)/.test(line) && line.includes("-f pr="))) {
      findings.push({
        check: "RELEASE",
        file: RELEASE_PLEASE,
        line: lineOf(text, lines.length > 0 ? start : "gh workflow run"),
        message: `starts no ${file} from main for each release pull request (${start} --ref main -f pr=<number>), so they miss ${statuses} (ADR 0174)`,
      });
    }
    const workflow = `.github/workflows/${file}`;
    const source = repo.exists(workflow) ? repo.read(workflow) : "";
    const inputs = (parse(source) as Dispatchable)?.on?.workflow_dispatch?.inputs ?? {};
    if (!("pr" in inputs)) {
      findings.push({
        check: "RELEASE",
        file: workflow,
        line: lineOf(source, "workflow_dispatch"),
        message:
          "has no workflow_dispatch input pr, which release-please.yml passes for each release pull request (ADR 0174)",
      });
    }
  }
  return findings;
}
