// The data of the work page "/work" (src/web/pages/work.astro): intake's latest work items, each with its origin,
// status, requester, run and age, so a person sees the work that waits, also work without a run yet; and the form
// "Submit work" when the console takes actions (ADR 0089), in the shell of the new look. The template only reads it.
import type { WorkItemView } from "@opensoftware/contracts";
import type { ShellData } from "@opensoftware/ui";
import { age } from "../domain/runs.ts";
import { linkOf } from "./runs.ts";

export interface WorkRow {
  /** The work item's title, linked to its origin when that is an http or https URL. */
  title: ReturnType<typeof linkOf>;
  type: string;
  status: string;
  /** The classes of the status: its shape and colour. */
  statusClass: string;
  source: string;
  requester: string;
  /** The run that works on it, or a dash before a run took it. */
  run: { href?: string; text: string };
  age: string;
}

export interface WorkData {
  shell: ShellData;
  /** Why intake's work items are missing. */
  notes: string[];
  rows: WorkRow[];
  /** Whether intake answered with no work item. */
  empty: boolean;
  /** Whether the page offers the form "Submit work": only when the console takes actions. */
  form: boolean;
  next?: string;
}

const rowOf = ({ workItem, status, runId, receivedAt }: WorkItemView, now: number): WorkRow => ({
  title: linkOf(workItem.origin.url, workItem.title),
  type: workItem.type,
  status,
  statusClass: `osf-state osf-state-${status}`,
  source: workItem.origin.source,
  requester: workItem.requester.displayName ?? workItem.requester.id,
  run: runId ? { href: `/runs/${runId}`, text: runId } : { text: "—" },
  age: age(receivedAt, now),
});

export function workData(
  shell: ShellData,
  items: WorkItemView[],
  now: number,
  at: { notes: string[]; form: boolean; next: string | undefined },
): WorkData {
  return {
    shell,
    notes: at.notes,
    rows: items.map((item) => rowOf(item, now)),
    // "No work items yet" only when intake answered: without its answer the page does not know.
    empty: items.length === 0 && at.notes.length === 0,
    form: at.form,
    ...(at.next ? { next: at.next } : {}),
  };
}
