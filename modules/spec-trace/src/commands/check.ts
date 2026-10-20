// spec-trace check: the findings of each rule, one line each, then `RULE ok` or `RULE failed: N`.
import { type Finding, type Inputs, RULES, type Rule } from "../domain/model.ts";
import { CHECKS } from "../domain/rules.ts";

export function findings(inputs: Inputs, rules: Rule[]): Finding[] {
  return rules.flatMap((rule) => CHECKS[rule](inputs));
}

export function check(inputs: Inputs, only: string | undefined): { lines: string[]; ok: boolean } {
  const rules = only === undefined ? RULES : only.split(",").map((rule) => rule.trim());
  const unknown = rules.filter((rule) => !RULES.includes(rule as Rule));
  if (unknown.length > 0) throw new Error(`unknown rule ${unknown.join(", ")}; known: ${RULES.join(", ")}`);
  const lines: string[] = [];
  let ok = true;
  for (const rule of rules as Rule[]) {
    const found = findings(inputs, [rule]);
    lines.push(...found.map(format), found.length > 0 ? `${rule} failed: ${found.length}` : `${rule} ok`);
    ok &&= found.length === 0;
  }
  return { lines, ok };
}

function format(finding: Finding): string {
  return `${finding.rule} ${finding.file}:${finding.line} ${finding.message}`;
}
