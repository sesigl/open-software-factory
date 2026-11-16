// The data of the work page "/work" (src/web/pages/work.astro): intake's latest work items, each with its origin,
// status, requester, run and age, so a person sees the work that waits, also work without a run yet; and the form
// "Submit work" when the console takes actions (ADR 0089), in the shell of the new look. The template only reads it.
// The list is the island "work-list" of the design system (ADR 0152): it loads the same rows from "/work/items" every
// CONSOLE_REFRESH seconds, so the page does not reload and a half-typed form stays.
import type { WorkItemView } from "@opensoftware/contracts";
import type { ShellData, WorkListData, WorkListItems, WorkListProps, WorkListRow } from "@opensoftware/ui";
import { age } from "../domain/runs.ts";
import { linkOf } from "./runs.ts";

/** The route of the list's rows as JSON, beside the work page. */
export const WORK_ITEMS = "/work/items";

export interface WorkData {
  shell: ShellData;
  /** Why intake's work items are missing. */
  notes: string[];
  /** The list of work items and the properties of its island. */
  list: WorkListData;
  /** Whether the page offers the form "Submit work": only when the console takes actions. */
  form: boolean;
  next?: string;
}

const rowOf = ({ workItem, status, runId, receivedAt }: WorkItemView, now: number): WorkListRow => ({
  title: linkOf(workItem.origin.url, workItem.title),
  type: workItem.type,
  status,
  statusClass: `osf-state osf-state-${status}`,
  source: workItem.origin.source,
  requester: workItem.requester.displayName ?? workItem.requester.id,
  run: runId ? { href: `/runs/${runId}`, text: runId } : { text: "—" },
  age: age(receivedAt, now),
});

/** The rows of a page of intake's work items, ready to show; also the answer of "/work/items". */
export function workItems(items: WorkItemView[], now: number, notes: string[]): WorkListItems {
  return {
    rows: items.map((item) => rowOf(item, now)),
    // "No work items yet" only when intake answered: without its answer the page does not know.
    empty: items.length === 0 && notes.length === 0,
  };
}

export function workData(
  shell: ShellData,
  items: WorkItemView[],
  now: number,
  at: { notes: string[]; form: boolean; next: string | undefined; query: string; refresh: number },
): WorkData {
  const props: WorkListProps = {
    ...workItems(items, now, at.notes),
    src: `${WORK_ITEMS}${at.query}`,
    interval: at.refresh * 1000,
    columns: ["Work item", "Type", "Status", "Source", "Requester", "Run", "Age"],
    emptyText: "No work items yet. Work arrives from the factory's sources and from this form.",
    failedText: "The list could not be refreshed: it shows the work items as they were.",
  };
  return {
    // A browser without script reloads the page instead (ADR 0130).
    shell: at.refresh ? { ...shell, refreshWithoutScript: at.refresh } : shell,
    notes: at.notes,
    list: { label: "Work items", props, island: JSON.stringify(props) },
    form: at.form,
    ...(at.next ? { next: at.next } : {}),
  };
}
