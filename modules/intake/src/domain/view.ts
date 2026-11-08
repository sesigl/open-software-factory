// What the API shows of a work item, and the event a new one publishes.
import { isValid, type WorkItem, type WorkItemView, type WorkReceived } from "@opensoftware/contracts";
import { isoOf } from "./time.ts";

/** One submission that asked for a work item. */
export interface Request {
  requester: WorkItem["requester"];
  origin: WorkItem["origin"];
  at: number;
}

export type Status = WorkItemView["status"];

export const STATUSES: Status[] = ["received", "running", "complete", "failed", "cancelled"];

/** The query of GET /v1/inbox: the status, if any, and the limit; or the problem with it. */
export function inboxQueryOf(query: { status?: string; limit?: string }): { status?: Status; limit: number } | string {
  const { status, limit } = query;
  if (status !== undefined && !STATUSES.includes(status as Status))
    return `status: no work item is "${status}"; ask for ${STATUSES.slice(0, -1).join(", ")} or ${STATUSES.at(-1)}`;
  const count = limit === undefined ? 50 : Number(limit);
  if (!Number.isInteger(count) || count < 1 || count > 200) return "limit: give a whole number from 1 to 200";
  return { ...(status ? { status: status as Status } : {}), limit: count };
}

export interface Stored {
  workItem: WorkItem;
  status: Status;
  runId?: string;
  receivedAt: number;
  requests: Request[];
}

export function viewOf(stored: Stored): WorkItemView {
  return {
    workItem: stored.workItem,
    status: stored.status,
    ...(stored.runId ? { runId: stored.runId } : {}),
    receivedAt: isoOf(stored.receivedAt),
    requests: stored.requests.map(({ requester, origin, at }) => ({ requester, origin, receivedAt: isoOf(at) })),
  };
}

export const SUBJECT = "osf.work.received.v1";

/** The event's ID is the work item's, so a consumer that gets it twice can drop the copy. */
export const receivedEvent = (workItem: WorkItem, at: number): WorkReceived => ({
  specversion: "1.0",
  id: workItem.id,
  source: "/osf/intake",
  type: "work.received@v1",
  time: isoOf(at),
  subject: workItem.id,
  datacontenttype: "application/json",
  data: workItem,
});

/** The foreman's run events that move a work item on (ADR 0071). */
export const RUN_SUBJECTS = ["osf.run.started.v1", "osf.run.completed.v1"];

/** What a run event says about its work item: its run, the status it moves to, and the run's pull requests. */
export interface RunFact {
  workItemId: string;
  runId: string;
  status: Exclude<Status, "received">;
  pullRequests: string[];
}

type RunEvent = {
  data: { runId: string; workItemId: string; outcome?: "succeeded" | "failed" | "cancelled"; pullRequests?: string[] };
};

/** The fact of a "run.started@v1" or "run.completed@v1", or a problem for any other message. */
export function runFactOf(event: unknown): RunFact | string {
  const type = (event as { type?: unknown } | undefined)?.type;
  const format = type === "run.started@v1" ? "run-started" : type === "run.completed@v1" ? "run-completed" : undefined;
  if (!format || !isValid(format, event)) return `not a run.started@v1 or run.completed@v1: ${JSON.stringify(event)}`;
  const { runId, workItemId, outcome, pullRequests = [] } = (event as RunEvent).data;
  const status = !outcome ? "running" : outcome === "succeeded" ? "complete" : outcome;
  return { workItemId, runId, status, pullRequests };
}
