// What the API shows of a work item, and the event a new one publishes.
import type { WorkItem, WorkItemView, WorkReceived } from "@opensoftware/contracts";
import { isoOf } from "./time.ts";

/** One submission that asked for a work item. */
export interface Request {
  requester: WorkItem["requester"];
  origin: WorkItem["origin"];
  at: number;
}

export interface Stored {
  workItem: WorkItem;
  receivedAt: number;
  requests: Request[];
}

export function viewOf(stored: Stored): WorkItemView {
  return {
    workItem: stored.workItem,
    status: "received",
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
