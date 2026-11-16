// The properties of the island "work-list" on the workbench's pages, as a console's route computes them: one work item
// that the server rendered, and the address of a static JSON file of the workbench that the island loads.
import type { WorkListData, WorkListProps, WorkListRow } from "../src/index.ts";

/** The work item the server rendered with the page. */
export const RENDERED: WorkListRow = {
  title: { href: "https://example.com/issues/1", text: "Import reports from CSV" },
  type: "task",
  status: "received",
  statusClass: "osf-state osf-state-received",
  source: "slack",
  requester: "Varun",
  run: { text: "—" },
  age: "2 d",
};

/** The island's data with the route `src` and the interval in milliseconds. */
export function workList(src: string, interval: number): WorkListData {
  const props: WorkListProps = {
    rows: [RENDERED],
    empty: false,
    src,
    interval,
    columns: ["Work item", "Type", "Status", "Source", "Requester", "Run", "Age"],
    emptyText: "No work items yet. Work arrives from the factory's sources and from this form.",
    failedText: "The list could not be refreshed: it shows the work items as they were.",
  };
  return { label: "Work items", props, island: JSON.stringify(props) };
}
