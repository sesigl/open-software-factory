// @ts-nocheck
// What the API shows of a work item, and the event a new one publishes.
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { isValid, type WorkItem, type WorkItemView, type WorkReceived } from "@opensoftware/contracts";
import { isoOf } from "./time.ts";

/** One submission that asked for a work item. */
export interface Request {
  requester: WorkItem["requester"];
  origin: WorkItem["origin"];
  at: number;
}
export type Status = WorkItemView["status"];
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
    ...(stored.runId ? {
      runId: stored.runId
    } : {}),
    receivedAt: isoOf(stored.receivedAt),
    requests: stored.requests.map(({
      requester,
      origin,
      at
    }) => ({
      requester,
      origin,
      receivedAt: isoOf(at)
    }))
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
  data: workItem
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
  data: {
    runId: string;
    workItemId: string;
    outcome?: "succeeded" | "failed" | "cancelled";
    pullRequests?: string[];
  };
};

/** The fact of a "run.started@v1" or "run.completed@v1", or a problem for any other message. */
export function runFactOf(event: unknown): RunFact | string {
  const type = (event as {
    type?: unknown;
  } | undefined)?.type;
  const format = type === "run.started@v1" ? "run-started" : type === "run.completed@v1" ? "run-completed" : undefined;
  if (!format || !isValid(format, event)) return `not a run.started@v1 or run.completed@v1: ${JSON.stringify(event)}`;
  const {
    runId,
    workItemId,
    outcome,
    pullRequests = stryMutAct_9fa48("16") ? ["Stryker was here"] : (stryCov_9fa48("16"), [])
  } = (event as RunEvent).data;
  const status = (stryMutAct_9fa48("17") ? outcome : (stryCov_9fa48("17"), !outcome)) ? stryMutAct_9fa48("18") ? "" : (stryCov_9fa48("18"), "running") : (stryMutAct_9fa48("21") ? outcome !== "succeeded" : stryMutAct_9fa48("20") ? false : stryMutAct_9fa48("19") ? true : (stryCov_9fa48("19", "20", "21"), outcome === (stryMutAct_9fa48("22") ? "" : (stryCov_9fa48("22"), "succeeded")))) ? stryMutAct_9fa48("23") ? "" : (stryCov_9fa48("23"), "complete") : outcome;
  return stryMutAct_9fa48("24") ? {} : (stryCov_9fa48("24"), {
    workItemId,
    runId,
    status,
    pullRequests
  });
}