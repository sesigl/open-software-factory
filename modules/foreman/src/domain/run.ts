// A run of the factory's workflow for one work item, without I/O (ADR 0067, ADR 0070): its ID, its first view, the next step,
// how each fact changes the view, and the events it publishes. The workflow asks for each step and applies each fact
// through local activities, so this code runs in the worker's own thread, not in Temporal's sandbox.
import { createHash } from "node:crypto";
import type { CheckView, RunCompleted, RunStarted, RunView, StageView, WorkItem } from "@opensoftware/contracts";
import type { Definition } from "./definition.ts";

export type { CheckView, RunView, StageView };
export type RunState = RunView["state"];
export type StageState = StageView["state"];

/** What the workflow gets when the run starts: the run's first view and the factory as it was then. */
export interface RunInput {
  view: RunView;
  definition: Definition;
}

/** What the workflow does next for the stage at `index`. */
export type Step =
  | { kind: "request-gate"; index: number }
  /** Read the stage's checks on the run's pull request, after `delayMs` when they were read before (ADR 0069). */
  | { kind: "read-checks"; index: number; delayMs: number }
  | { kind: "await-gate"; index: number; gateId: string }
  /** Wait until the person who took the stage over hands the run back (ADR 0070). */
  | { kind: "await-hand-back"; index: number }
  | { kind: "run-stage"; index: number }
  | { kind: "end" };

export type GateState = "pending" | "approved" | "rejected" | "expired";

/** A gate's state as gatekeeper answered it, or as a `gate.decided@v1` reported it. */
export interface GateDecision {
  gateId: string;
  state: GateState;
}

/** Something that happened to a run. Each fact moves the view on. */
export type Fact =
  | ({ kind: "gate"; index: number } & GateDecision)
  | { kind: "checks"; index: number; checks: CheckView[]; reason?: string }
  | { kind: "stage-started"; index: number }
  | {
      kind: "stage-ended";
      index: number;
      stopReason: string;
      sessionId?: string;
      pullRequest?: string;
      /** A person took the stage over; the run's files are in `folder`. */
      takenOver?: { folder: string };
    }
  | { kind: "handed-back"; index: number }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

const ENDED: ReadonlySet<RunState> = new Set(["complete", "failed", "cancelled"]);

/** "run_" and 20 hex digits of the SHA-256 of the work item's ID: one run per work item. */
export const runIdOf = (workItemId: string): string =>
  `run_${createHash("sha256").update(workItemId).digest("hex").slice(0, 20)}`;

export function firstView(workItem: WorkItem, definition: Definition, version: string, startedAt: string): RunView {
  return {
    runId: runIdOf(workItem.id),
    workItem,
    factory: definition.factory,
    factoryVersion: version,
    state: "running",
    startedAt,
    stages: definition.stages.map(({ stage, agent }) => ({ stage, agent, state: "pending" })),
  };
}

export const hasEnded = (view: RunView): boolean => ENDED.has(view.state);

/** The next step; a stage whose checks are pending reads them again after `checkPollMs`. */
export function nextStep(view: RunView, definition: Definition, checkPollMs: number): Step {
  if (hasEnded(view)) return { kind: "end" };
  // A run whose last stage succeeded is complete, so a run that goes on has a stage that did not succeed.
  const index = view.stages.findIndex((stage) => stage.state !== "succeeded");
  const stage = view.stages[index] as StageView;
  const plan = definition.stages[index];
  if (stage.state === "blocked" && stage.takenOverAt) return { kind: "await-hand-back", index };
  if (stage.state === "blocked" && stage.gateId) return { kind: "await-gate", index, gateId: stage.gateId };
  // Checks come before the gate: nobody is asked to approve a change whose checks fail.
  if (plan?.checks?.length && !stage.checks?.every((check) => check.state === "success"))
    return { kind: "read-checks", index, delayMs: stage.checks ? checkPollMs : 0 };
  if (plan?.gate && !stage.gateId) return { kind: "request-gate", index };
  return { kind: "run-stage", index };
}

/** The view after the fact, at the time `at`. */
export function apply(view: RunView, fact: Fact, at: string): RunView {
  const next: RunView = { ...view, stages: view.stages.map((stage) => ({ ...stage })) };
  const end = (state: RunState): RunView => ({ ...next, state, endedAt: at });
  switch (fact.kind) {
    case "gate":
      return gate(next, fact, end);
    case "checks":
      return checks(next, fact, end);
    case "stage-started": {
      Object.assign(next.stages[fact.index] as StageView, { state: "running", startedAt: at });
      return next;
    }
    case "stage-ended": {
      const stage = next.stages[fact.index] as StageView;
      if (fact.sessionId) stage.sessionId = fact.sessionId;
      if (fact.pullRequest) next.pullRequest = fact.pullRequest;
      if (fact.takenOver) {
        Object.assign(stage, { state: "blocked", takenOverAt: at });
        return { ...next, state: "blocked", folder: fact.takenOver.folder };
      }
      return stageEnded(next, fact.index, stageStateOf(fact.stopReason), at);
    }
    case "handed-back":
      return stageEnded({ ...next, state: "running" }, fact.index, "succeeded", at);
    case "cancelled":
    case "error": {
      const stopped: StageState = fact.kind === "cancelled" ? "cancelled" : "failed";
      for (const stage of next.stages)
        if (stage.state === "running" || stage.state === "blocked")
          Object.assign(stage, { state: stopped, endedAt: at });
      return hasEnded(view) ? view : end(fact.kind === "cancelled" ? "cancelled" : "failed");
    }
  }
}

/** The view after the stage at `index` ended in `state`: a stage that did not succeed ends the run. */
function stageEnded(next: RunView, index: number, state: StageState, at: string): RunView {
  Object.assign(next.stages[index] as StageView, { state, endedAt: at });
  if (state !== "succeeded") return { ...next, state: state === "cancelled" ? "cancelled" : "failed", endedAt: at };
  return index === next.stages.length - 1 ? { ...next, state: "complete", endedAt: at } : next;
}

function gate(next: RunView, fact: GateDecision & { index: number }, end: (state: RunState) => RunView): RunView {
  const stage = next.stages[fact.index] as StageView;
  stage.gateId = fact.gateId;
  if (fact.state === "pending") {
    stage.state = "blocked";
    return { ...next, state: "blocked" };
  }
  if (fact.state === "approved") {
    stage.state = "pending";
    return { ...next, state: "running" };
  }
  stage.state = "rejected";
  return end("failed");
}

function checks(next: RunView, fact: Extract<Fact, { kind: "checks" }>, end: (state: RunState) => RunView): RunView {
  const stage = next.stages[fact.index] as StageView;
  if (fact.checks.length) stage.checks = fact.checks;
  const failed = fact.checks.find((check) => check.state === "failure" || check.state === "error");
  const reason = fact.reason ?? (failed && `the check ${failed.name} ended with ${failed.state}`);
  if (reason) {
    Object.assign(stage, { state: "failed", reason });
    return end("failed");
  }
  if (fact.checks.every((check) => check.state === "success")) {
    stage.state = "pending";
    return { ...next, state: "running" };
  }
  stage.state = "blocked";
  return { ...next, state: "blocked" };
}

/** The states of the named checks in what the forge port's `pr` printed; a check it does not list is pending. */
export function checksOf(names: string[], printed: { name: string; state: string }[]): CheckView[] {
  return names.map((name) => {
    const state = printed.find((check) => check.name === name)?.state;
    return { name, state: state === "success" || state === "failure" || state === "error" ? state : "pending" };
  });
}

// A pull request's page on GitHub (/pull/<n>) or Forgejo (/pulls/<n>), as runlog finds it.
const PULL_REQUEST = /https?:\/\/[^\s"'<>()]+\/([^/\s"'<>()]+)\/([^/\s"'<>()]+)\/pulls?\/(\d+)/g;

/** The last pull request link in the text. */
export const lastPullRequestIn = (text: string): string | undefined => [...text.matchAll(PULL_REQUEST)].pop()?.[0];

/** The repository `<owner>/<name>` and number of a pull request link. */
export function pullRequestOf(url: string): { repo: string; number: string } {
  const [, owner, name, number] = [...url.matchAll(PULL_REQUEST)][0] as RegExpMatchArray;
  return { repo: `${owner}/${name}`, number: number as string };
}

/** How a turn's stop reason ends its stage (harness port): only `end_turn` succeeds. */
export function stageStateOf(stopReason: string): StageState {
  if (stopReason === "end_turn") return "succeeded";
  if (stopReason === "cancelled") return "cancelled";
  return "failed";
}

/** The prompt of a stage: the agent's prompt, then the work item and the run's pull request. */
export function promptOf(agentPrompt: string, workItem: WorkItem, pullRequest?: string): string {
  const description = workItem.description ? `\n\n${workItem.description}` : "";
  const link = pullRequest ? `\n\nPull request: ${pullRequest}` : "";
  return `${agentPrompt.trimEnd()}\n\n# Work item ${workItem.id}\n\n${workItem.title}${description}${link}\n`;
}

/** What a running stage asks its run for: the steering messages so far, and the stage a person takes over. */
export interface Control {
  steering: string[];
  takeOver?: number;
}

export type Signal = { type: "steer"; message: string } | { type: "cancel" | "take-over" | "hand-back" };

/** The signal in a request's body, or the problem with it as "<JSON Pointer>: <what is wrong>". */
export function signalOf(body: unknown): Signal | string {
  const { type, message } = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (type === "cancel" || type === "take-over" || type === "hand-back") return { type };
  if (type !== "steer") return `/type: must be "steer", "cancel", "take-over" or "hand-back"`;
  if (typeof message !== "string" || message === "") return "/message: a steering message needs the text";
  return { type, message };
}

/** The summary gatekeeper shows the approvers. */
export const gateSummaryOf = (view: RunView, index: number): string =>
  `${view.workItem.title}: start the stage ${view.stages[index]?.stage}`;

const SOURCE = "/osf/foreman";

export function runStarted(view: RunView): RunStarted {
  return {
    specversion: "1.0",
    id: `${view.runId}.started`,
    source: SOURCE,
    type: "run.started@v1",
    time: view.startedAt,
    subject: view.runId,
    datacontenttype: "application/json",
    data: {
      runId: view.runId,
      workItemId: view.workItem.id,
      factory: view.factory,
      factoryVersion: view.factoryVersion,
      stages: view.stages.map((stage) => stage.stage),
      startedAt: view.startedAt,
      requester: view.workItem.requester,
      source: view.workItem.origin.source,
    },
  };
}

export function runCompleted(view: RunView): RunCompleted {
  const endedAt = view.endedAt ?? view.startedAt;
  const last = [...view.stages].reverse().find((stage) => stage.state !== "pending");
  return {
    specversion: "1.0",
    id: `${view.runId}.completed`,
    source: SOURCE,
    type: "run.completed@v1",
    time: endedAt,
    subject: view.runId,
    datacontenttype: "application/json",
    data: {
      runId: view.runId,
      workItemId: view.workItem.id,
      ...(last ? { stage: last.stage } : {}),
      factoryVersion: view.factoryVersion,
      outcome: view.state === "complete" ? "succeeded" : view.state === "cancelled" ? "cancelled" : "failed",
      startedAt: view.startedAt,
      endedAt,
      requester: view.workItem.requester,
      source: view.workItem.origin.source,
      ...(view.pullRequest ? { pullRequests: [view.pullRequest] } : {}),
    },
  };
}
