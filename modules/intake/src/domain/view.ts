// What the API shows of a work item, the event a new one publishes, and the event that asks to run it again.
import {
  isValid,
  type WorkItem,
  type WorkItemView,
  type WorkReceived,
  type WorkRetryRequested,
} from "@opensoftware/contracts";
import { isoOf } from "./time.ts";

/** One submission that asked for a work item. */
export interface Request {
  requester: WorkItem["requester"];
  origin: WorkItem["origin"];
  at: number;
}

export type Status = WorkItemView["status"];

export const STATUSES: Status[] = ["received", "running", "complete", "failed", "cancelled"];

/** The status of GET /v1/inbox?status=, if any; or the problem with it. */
export function inboxStatusOf(status: string | undefined): { status?: Status } | string {
  if (status === undefined) return {};
  return STATUSES.includes(status as Status) ? { status: status as Status } : `status: one of ${STATUSES.join(", ")}`;
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

export const RETRY_SUBJECT = "osf.work.retry-requested.v1";

/** The event that asks the foreman to run the run again (ADR 0105); its ID is the run's, so it is asked once per run. */
export const retryEvent = (workItem: WorkItem, runId: string, at: number): WorkRetryRequested => ({
  specversion: "1.0",
  id: `${runId}.retry`,
  source: "/osf/intake",
  type: "work.retry-requested@v1",
  time: isoOf(at),
  subject: workItem.id,
  datacontenttype: "application/json",
  data: { workItemId: workItem.id, runId, requester: workItem.requester },
});

/**
 * The foreman's run events that move a work item on (ADR 0071), and the gatekeeper's request for a decision, which
 * its requesters hear about (ADR 0113).
 */
export const RUN_SUBJECTS = ["osf.run.started.v1", "osf.run.completed.v1", "osf.gate.requested.v1"];

/** What a run event says about its work item: its run, the status it moves to, and the run's pull requests. */
export interface RunFact {
  workItemId: string;
  runId: string;
  status: Exclude<Status, "received">;
  pullRequests: string[];
  /** The stage the run ended at, when the foreman names it. */
  stage?: string;
  /** The run before, whose work item this run takes over (ADR 0105). */
  retryOf?: string;
}

type RunEvent = {
  data: {
    runId: string;
    workItemId: string;
    outcome?: "succeeded" | "failed" | "cancelled";
    pullRequests?: string[];
    stage?: string;
    retryOf?: string;
  };
};

/** The fact of a "run.started@v1" or "run.completed@v1", or a problem for any other message. */
export function runFactOf(event: unknown): RunFact | string {
  const type = (event as { type?: unknown } | undefined)?.type;
  const format = type === "run.started@v1" ? "run-started" : type === "run.completed@v1" ? "run-completed" : undefined;
  if (!format || !isValid(format, event)) return `not a run.started@v1 or run.completed@v1: ${JSON.stringify(event)}`;
  const { runId, workItemId, outcome, pullRequests = [], stage, retryOf } = (event as RunEvent).data;
  const status = !outcome ? "running" : outcome === "succeeded" ? "complete" : outcome;
  return { workItemId, runId, status, pullRequests, ...(stage ? { stage } : {}), ...(retryOf ? { retryOf } : {}) };
}
