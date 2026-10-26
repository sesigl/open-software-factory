// A run of the factory's workflow for one work item, without I/O (ADR 0067): its ID, its first view, the next step,
// how each fact changes the view, and the events it publishes. The workflow asks for each step and applies each fact
// through local activities, so this code runs in the worker's own thread, not in Temporal's sandbox.
import { createHash } from "node:crypto";
import type { RunCompleted, RunStarted, RunView, StageView, WorkItem } from "@opensoftware/contracts";
import type { Definition } from "./definition.ts";

export type { RunView, StageView };
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
  | { kind: "await-gate"; index: number; gateId: string }
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
  | { kind: "stage-started"; index: number }
  | { kind: "stage-ended"; index: number; stopReason: string; sessionId?: string }
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

export function nextStep(view: RunView, definition: Definition): Step {
  if (hasEnded(view)) return { kind: "end" };
  const index = view.stages.findIndex((stage) => stage.state !== "succeeded");
  const stage = view.stages[index];
  if (!stage) return { kind: "end" };
  if (stage.state === "blocked" && stage.gateId) return { kind: "await-gate", index, gateId: stage.gateId };
  if (definition.stages[index]?.gate && !stage.gateId) return { kind: "request-gate", index };
  return { kind: "run-stage", index };
}

/** The view after the fact, at the time `at`. */
export function apply(view: RunView, fact: Fact, at: string): RunView {
  const next: RunView = { ...view, stages: view.stages.map((stage) => ({ ...stage })) };
  const end = (state: RunState): RunView => ({ ...next, state, endedAt: at });
  switch (fact.kind) {
    case "gate":
      return gate(next, fact, end);
    case "stage-started": {
      Object.assign(next.stages[fact.index] as StageView, { state: "running", startedAt: at });
      return { ...next, state: "running" };
    }
    case "stage-ended": {
      const state = stageStateOf(fact.stopReason);
      const stage = next.stages[fact.index] as StageView;
      Object.assign(stage, { state, endedAt: at }, fact.sessionId ? { sessionId: fact.sessionId } : {});
      if (state !== "succeeded") return end(state === "cancelled" ? "cancelled" : "failed");
      return fact.index === next.stages.length - 1 ? end("complete") : next;
    }
    case "cancelled":
    case "error": {
      const stopped: StageState = fact.kind === "cancelled" ? "cancelled" : "failed";
      for (const stage of next.stages)
        if (stage.state === "running" || stage.state === "blocked") Object.assign(stage, { state: stopped, endedAt: at });
      return hasEnded(view) ? view : end(fact.kind === "cancelled" ? "cancelled" : "failed");
    }
  }
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

/** How a turn's stop reason ends its stage (harness port): only `end_turn` succeeds. */
export function stageStateOf(stopReason: string): StageState {
  if (stopReason === "end_turn") return "succeeded";
  if (stopReason === "cancelled") return "cancelled";
  return "failed";
}

/** The prompt of a stage: the agent's prompt, then the work item. */
export function promptOf(agentPrompt: string, workItem: WorkItem): string {
  const description = workItem.description ? `\n\n${workItem.description}` : "";
  return `${agentPrompt.trimEnd()}\n\n# Work item ${workItem.id}\n\n${workItem.title}${description}\n`;
}

export type Signal = { type: "steer"; message: string } | { type: "cancel" };

/** The signal in a request's body, or the problem with it as "<JSON Pointer>: <what is wrong>". */
export function signalOf(body: unknown): Signal | string {
  const { type, message } = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (type === "cancel") return { type };
  if (type !== "steer") return `/type: must be "steer" or "cancel"`;
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
    },
  };
}
