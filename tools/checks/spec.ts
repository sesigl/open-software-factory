// SPEC and SPECGUARD: the scenarios themselves.

import picomatch from "picomatch";
import { approvers, ownersOf } from "./lib/codeowners.ts";
import type { Context } from "./lib/context.ts";
import { byId, FEATURE_GLOBS, ID_PATTERN, parseFeature, type Scenario, STATUSES, statusOf } from "./lib/features.ts";
import { filesAt, showAt } from "./lib/git.ts";
import { loadPrefixes, PREFIX_FILE } from "./lib/prefixes.ts";
import { type Finding, isTemplate } from "./lib/repo.ts";

export function spec(context: Context): Finding[] {
  const { scenarios, errors } = context.features();
  const prefixes = loadPrefixes(context.repo);
  const findings: Finding[] = [...errors];
  const first = new Map<string, Scenario>();
  const at = (scenario: Scenario, message: string): void => {
    findings.push({ check: "SPEC", file: scenario.file, line: scenario.line, message });
  };

  for (const scenario of scenarios) {
    if (scenario.ids.length !== 1) at(scenario, `needs exactly one @id tag, has ${scenario.ids.length}`);
    if (scenario.statuses.length !== 1) at(scenario, `needs exactly one @status tag, has ${scenario.statuses.length}`);
    for (const status of scenario.statuses) {
      if (!STATUSES.includes(status)) at(scenario, `@status=${status} is not one of ${STATUSES.join(", ")}`);
    }
    for (const id of scenario.ids) {
      const match = ID_PATTERN.exec(id);
      if (!match) {
        at(scenario, `ID ${id} does not match SCN-<PREFIX>-NNN`);
        continue;
      }
      const prefix = prefixes.get(match[1] as string);
      if (!prefix) at(scenario, `prefix ${match[1]} is not registered in ${PREFIX_FILE}`);
      else if (!scenario.file.startsWith(prefix.path)) {
        at(scenario, `prefix ${prefix.prefix} belongs to ${prefix.path} (${PREFIX_FILE}:${prefix.line})`);
      }
      const earlier = first.get(id);
      if (earlier) at(scenario, `duplicate ID ${id}, first at ${earlier.file}:${earlier.line}`);
      else first.set(id, scenario);
    }
  }
  return findings;
}

/** A changed, deleted or downgraded implemented scenario needs an approval from a code owner of its file. */
export function specguard(context: Context): Finding[] {
  const base = context.base("SPECGUARD");
  if (!base) return [];
  const { root } = context.repo;
  const isFeature = picomatch(FEATURE_GLOBS);
  const before: Scenario[] = [];
  for (const file of filesAt(root, base).filter((path) => isFeature(path) && !isTemplate(path))) {
    before.push(...parseFeature(file, showAt(root, base, file) ?? "").scenarios);
  }
  const now = byId(context.features().scenarios);
  const approved = approvers(context.repo);
  const findings: Finding[] = [];

  for (const [id, old] of byId(before)) {
    if (statusOf(old) !== "implemented") continue;
    const current = now.get(id);
    let change: string | undefined;
    if (!current) change = "was deleted";
    else if (statusOf(current) !== "implemented") change = `changed its status to ${statusOf(current) ?? "nothing"}`;
    else if (stepsOf(old) !== stepsOf(current)) change = "changed its steps";
    if (!change) continue;

    const where = current ?? old;
    const owners = ownersOf(context.repo, where.file);
    if (owners.some((owner) => approved.has(owner.replace(/^@/, "").toLowerCase()))) continue;
    const who = owners.length > 0 ? owners.join(" or ") : "a code owner (no CODEOWNERS rule matches)";
    findings.push({
      check: "SPECGUARD",
      file: where.file,
      line: where.line,
      message: `${id} ${change}; an implemented scenario changes only with an approval from ${who}`,
    });
  }
  return findings;
}

function stepsOf(scenario: Scenario): string {
  return scenario.steps.map((step) => `${step.keyword} ${step.text}`).join("\n");
}
