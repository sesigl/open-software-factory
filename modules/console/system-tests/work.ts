// Shared setup of the scenarios of the work page's island (ADR 0152): work items as intake's inbox shows them, and
// the rows that the console makes of them.
import type { WorkItemView } from "@opensoftware/contracts";
import { RUN, runOf, SLACK_THREAD } from "./console.ts";

/** A work item with this title and status, received two days before the testkit's clock, in this run. */
export const workItemOf = (
  title: string,
  status: WorkItemView["status"] = "received",
  runId?: string,
): WorkItemView => ({
  workItem: { ...runOf(title).workItem, id: `wi_${title.length.toString(16).padStart(20, "0")}` },
  status,
  ...(runId ? { runId } : {}),
  receivedAt: "2025-12-30T00:00:00Z",
  requests: [],
});

export const IMPORT = "Import reports from CSV";
export const EXPORT = "Export reports as CSV";

/** The row of "Import reports from CSV" as the console shows it. */
export const IMPORT_ROW = {
  title: { href: SLACK_THREAD, text: IMPORT },
  type: "task",
  status: "received",
  statusClass: "osf-state osf-state-received",
  source: "slack",
  requester: "Varun",
  run: { text: "—" },
  age: "2 d",
};

/** The row of "Export reports as CSV", running in RUN. */
export const EXPORT_ROW = {
  ...IMPORT_ROW,
  title: { href: SLACK_THREAD, text: EXPORT },
  status: "running",
  statusClass: "osf-state osf-state-running",
  run: { href: `/runs/${RUN}`, text: RUN },
};
