// SPEC: the scenarios themselves.

import type { Context } from "./lib/context.ts";
import { ID_PATTERN, type Scenario, STATUSES } from "./lib/features.ts";
import { loadPrefixes, PREFIX_FILE } from "./lib/prefixes.ts";
import type { Finding } from "./lib/repo.ts";

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
