// The scenarios a change adds, removes or changes, compared with a base commit.
import { byId, type Scenario, statusOf } from "./model.ts";

export interface Changes {
  base: string;
  added: string[];
  removed: string[];
  status: { id: string; from: string; to: string }[];
  steps: string[];
}

export function changes(base: string, before: Scenario[], after: Scenario[]): Changes {
  const old = byId(before);
  const now = byId(after);
  const result: Changes = { base, added: [], removed: [], status: [], steps: [] };
  for (const [id, scenario] of now) {
    const earlier = old.get(id);
    if (!earlier) {
      result.added.push(id);
      continue;
    }
    const from = statusOf(earlier) ?? "unknown";
    const to = statusOf(scenario) ?? "unknown";
    if (from !== to) result.status.push({ id, from, to });
    if (text(earlier) !== text(scenario)) result.steps.push(id);
  }
  result.removed = [...old.keys()].filter((id) => !now.has(id));
  result.added.sort();
  result.removed.sort();
  result.status.sort((a, b) => a.id.localeCompare(b.id));
  result.steps.sort();
  return result;
}

function text(scenario: Scenario): string {
  return scenario.steps.map((step) => `${step.keyword} ${step.text}`).join("\n");
}

export function changeLine(changes: Changes): string {
  return `since the base: ${changes.added.length} added, ${changes.removed.length} removed, ${changes.status.length} with a new status, ${changes.steps.length} with new steps`;
}
