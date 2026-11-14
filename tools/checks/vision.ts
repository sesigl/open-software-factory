// VISION and TODO: the status lines of docs/vision/software-factory.feature follow the module scenarios that realize
// them, and an open item of TODO.md has an open slice (ADR 0117).
import { tagValues } from "@opensoftware/spec-files";
import type { Context } from "./lib/context.ts";
import { loadScenarios } from "./lib/features.ts";
import type { Finding, Repo } from "./lib/repo.ts";

export const VISION_FILE = "docs/vision/software-factory.feature";
const TODO_FILE = "TODO.md";

export interface Realizer {
  id: string;
  status: string;
}

export interface VisionRow {
  id: string;
  line: number;
  status: string;
  /** The status the realizing scenarios give: implemented when there is one and every live one is implemented. */
  expected: "implemented" | "planned";
  realizers: Realizer[];
}

/**
 * Every vision scenario with the module scenarios whose `@realizes=` names it. The vision file holds several
 * features, which Gherkin does not parse, so its tag lines are read one by one.
 */
export function visionRows(repo: Repo, scenarios = loadScenarios(repo).scenarios): VisionRow[] {
  if (!repo.exists(VISION_FILE)) return [];
  const realizers = realizersById(scenarios);
  const rows: VisionRow[] = [];
  repo
    .read(VISION_FILE)
    .split("\n")
    .forEach((text, index) => {
      const id = /@scenario_id=(\S+)/.exec(text)?.[1];
      if (!id) return;
      const found = realizers.get(id) ?? [];
      const live = found.filter((realizer) => realizer.status !== "deprecated");
      const done = live.length > 0 && live.every((realizer) => realizer.status === "implemented");
      rows.push({
        id,
        line: index + 1,
        status: /@status=(\S+)/.exec(text)?.[1] ?? "(no status)",
        expected: done ? "implemented" : "planned",
        realizers: found,
      });
    });
  return rows;
}

function realizersById(scenarios: ReturnType<typeof loadScenarios>["scenarios"]): Map<string, Realizer[]> {
  const byId = new Map<string, Realizer[]>();
  for (const scenario of scenarios) {
    for (const target of tagValues(scenario.tags, "realizes")) {
      const list = byId.get(target) ?? [];
      list.push({ id: scenario.ids[0] ?? "(no ID)", status: scenario.statuses[0] ?? "(no status)" });
      byId.set(target, list);
    }
  }
  return byId;
}

/** The generated report of docs/vision/README.md. */
export function visionTable(repo: Repo): string {
  const rows = visionRows(repo).map((row) => {
    const by = row.realizers.map((realizer) => `${realizer.id} (${realizer.status})`).join(", ");
    return `| ${row.id} | ${row.status} | ${by || "none"} |`;
  });
  if (rows.length === 0) return "There are no vision scenarios.";
  return ["| Vision scenario | Status | Realized by |", "| --- | --- | --- |", ...rows].join("\n");
}

export function vision(context: Context): Finding[] {
  const { repo } = context;
  if (!repo.exists(VISION_FILE)) return [];
  return visionRows(repo, context.features().scenarios)
    .filter((row) => row.status !== row.expected)
    .map((row) => ({
      check: "VISION",
      file: VISION_FILE,
      line: row.line,
      message: `${row.id} is ${row.status}, but the scenarios that realize it make it ${row.expected}: set @status=${row.expected}`,
    }));
}

/**
 * An open item (`### [ ] T-..`) whose slices (`- [x] ...`) are all ticked is done or misses its last slice. Its block
 * ends at the next heading or rule. An item without slices is not cut into slices yet and passes.
 */
export function todo({ repo }: Context): Finding[] {
  if (!repo.exists(TODO_FILE)) return [];
  const findings: Finding[] = [];
  let open: { name: string; line: number; slices: number; ticked: number } | undefined;
  const close = (): void => {
    if (open && open.ticked > 0 && open.slices === 0) {
      findings.push({
        check: "TODO",
        file: TODO_FILE,
        line: open.line,
        message: `${open.name} is open, but every slice is ticked: tick the item, or add the slice that is left`,
      });
    }
    open = undefined;
  };
  repo
    .read(TODO_FILE)
    .split("\n")
    .forEach((text, index) => {
      if (/^#|^---\s*$/.test(text)) {
        close();
        const item = /^### \[ \] (T-\d+)/.exec(text)?.[1];
        if (item) open = { name: item, line: index + 1, slices: 0, ticked: 0 };
      } else if (open && /^\s*- \[ \] /.test(text)) {
        open.slices++;
      } else if (open && /^\s*- \[x\] /.test(text)) {
        open.ticked++;
      }
    });
  close();
  return findings;
}
