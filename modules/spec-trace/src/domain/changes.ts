// The scenarios a change adds, removes or changes, compared with a base commit.
import { byId, type Scenario, statusOf } from "./model.ts";

/** An Examples row by the names of its columns. */
export type Row = Record<string, string>;

/** The Examples rows of one Outline that a change adds, removes or changes. */
export interface ExampleChanges {
  id: string;
  added: Row[];
  removed: Row[];
  changed: { from: Row; to: Row }[];
}

export interface Changes {
  base: string;
  added: string[];
  removed: string[];
  status: { id: string; from: string; to: string }[];
  steps: string[];
  /** The Outlines whose Examples rows changed, in the order of the feature files; left out when there are none. */
  examples?: ExampleChanges[];
}

export function changes(base: string, before: Scenario[], after: Scenario[]): Changes {
  const old = byId(before);
  const now = byId(after);
  const result: Changes = { base, added: [], removed: [], status: [], steps: [] };
  const examples: ExampleChanges[] = [];
  for (const [id, scenario] of now) {
    const earlier = old.get(id);
    const rows = exampleChanges(id, earlier?.rows ?? [], scenario.rows);
    if (rows) examples.push(rows);
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
  if (examples.length > 0) result.examples = examples;
  return result;
}

/**
 * A row is the same row when all its cells are the same, wherever it stands, so moving rows is no change. Of the
 * rows left, a removed and an added row are one changed row when they alone share their first cell; otherwise
 * they stay removed and added. Undefined when no row changed.
 */
function exampleChanges(id: string, before: Row[], after: Row[]): ExampleChanges | undefined {
  const removed = [...before];
  const added: Row[] = [];
  for (const row of after) {
    const index = removed.findIndex((earlier) => key(earlier) === key(row));
    if (index === -1) added.push(row);
    else removed.splice(index, 1);
  }
  if (added.length + removed.length === 0) return undefined;
  const changed: { from: Row; to: Row }[] = [];
  for (const to of [...added]) {
    const from = only(removed, to);
    if (!from || only(added, from) !== to) continue;
    changed.push({ from, to });
    removed.splice(removed.indexOf(from), 1);
    added.splice(added.indexOf(to), 1);
  }
  return { id, added, removed, changed };
}

/** The one row of `rows` whose first cell is the first cell of `row`, or undefined when there is none or more. */
function only(rows: Row[], row: Row): Row | undefined {
  const same = rows.filter((other) => first(other) === first(row));
  return same.length === 1 ? same[0] : undefined;
}

function first(row: Row): string | undefined {
  return Object.values(row)[0];
}

function key(row: Row): string {
  return JSON.stringify(Object.entries(row));
}

function text(scenario: Scenario): string {
  return scenario.steps.map((step) => `${step.keyword} ${step.text}`).join("\n");
}

/** The cells of a row with their column names, for the summary: `qty = 2, price = 6`. */
export function cells(row: Row): string {
  return Object.entries(row)
    .map(([column, value]) => `${column} = ${value}`)
    .join(", ");
}

export function changeLine(changes: Changes): string {
  const line = `since the base: ${changes.added.length} added, ${changes.removed.length} removed, ${changes.status.length} with a new status, ${changes.steps.length} with new steps`;
  return changes.examples ? `${line}, ${changes.examples.length} with new examples` : line;
}
