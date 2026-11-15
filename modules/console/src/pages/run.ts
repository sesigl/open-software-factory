// The data of the run page "/runs/<runId>" (src/web/pages/run.astro): the run's origin and requests, its stages
// with their gates and checks as its evidence, links to its pull request, trace, transcripts and history (VIS-002),
// and the forms of a person's actions (ADR 0105, ADR 0118), in the shell of the new look. The template only reads it.
import type { GateView, RunView, StageView, WorkRequest } from "@opensoftware/contracts";
import type { ShellData } from "@opensoftware/ui";
import { age } from "../domain/runs.ts";
import { linkOf } from "./runs.ts";

export interface RunLinks {
  trace?: string;
  history?: string;
  /** A stage's transcript, by its harness session. */
  transcript: (sessionId: string) => string | undefined;
  /** A stage's span in the run's trace (ADR 0121). */
  span: (spanId: string) => string | undefined;
}

/** A link when its URL is http or https, else only its text. */
type Link = ReturnType<typeof linkOf>;

export interface StageRow {
  /** The stage's name, linked to its span when the run's trace and the stage's span are known (ADR 0121). */
  name: Link;
  /** The agent, or "waits" for a stage that only waits. */
  agent: string;
  state: string;
  stateClass: string;
  /** The transcript of the stage's harness session, or an empty text without a session. */
  transcript: Link;
  /** The gate's ID, state and who it waits for. */
  gate: string;
  /** The action of the forms "Approve" and "Reject", for a pending gate that the person may decide. */
  decide: string | undefined;
  checks: string;
  reason: string;
}

export interface RunData {
  shell: ShellData;
  runId: string;
  title: string;
  /** The attempt and the run before, for a run that a person ran again. */
  attempt: { number: number | undefined; before: { href: string; runId: string } } | undefined;
  state: string;
  stateClass: string;
  factory: string;
  version: string;
  age: string;
  pullRequest: Link;
  trace: Link;
  history: Link;
  /** The action of the form "Run again", for a failed or cancelled run. */
  retry: string | undefined;
  /** The forms that signal a running or blocked run, and which of "Take over" and "Hand back" it offers. */
  signals: { action: string; takeOver: boolean; handBack: boolean } | undefined;
  requests: { origin: Link; requester: string }[];
  stages: StageRow[];
  /** The signals people sent the run, with who sent them (ADR 0118), or none when nobody sent one. */
  actions: string[] | undefined;
}

const gateText = (stage: StageView, gate: GateView | undefined) => {
  if (!gate) return stage.gateId ?? "";
  const waiting = gate.waitingFor?.length ? `, waiting for ${gate.waitingFor.join(", ")}` : "";
  return `${gate.id} ${gate.state}${waiting}`;
};

const stageRow = (
  run: RunView,
  stage: StageView,
  gate: GateView | undefined,
  links: RunLinks,
  decides: boolean,
): StageRow => {
  const span = stage.spanId ? links.span(stage.spanId) : undefined;
  return {
    name: span ? linkOf(span, stage.stage) : { text: stage.stage },
    agent: stage.wait ? "waits" : stage.agent,
    state: stage.state,
    stateClass: `osf-state osf-state-${stage.state}`,
    transcript: stage.sessionId ? linkOf(links.transcript(stage.sessionId), stage.sessionId) : { text: "" },
    gate: gateText(stage, gate),
    decide: decides && gate?.state === "pending" ? `/runs/${run.runId}/gates/${gate.id}` : undefined,
    checks: (stage.checks ?? []).map((check) => `${check.name}: ${check.state}`).join(", "),
    reason: stage.reason ?? "",
  };
};

/** The forms that signal a run, when the console takes actions and the run is running or blocked (ADR 0118). */
const signalsOf = (run: RunView, actions: boolean): RunData["signals"] =>
  actions && (run.state === "running" || run.state === "blocked")
    ? {
        action: `/runs/${run.runId}/signals`,
        takeOver: run.stages.some((stage) => stage.state === "running"),
        handBack: run.stages.some((stage) => stage.state === "blocked" && stage.takenOverAt),
      }
    : undefined;

export function runData(
  shell: ShellData,
  run: RunView,
  requests: WorkRequest[],
  gates: Map<string, GateView>,
  links: RunLinks,
  now: number,
  at: { actions: boolean; decides: boolean },
): RunData {
  return {
    shell,
    runId: run.runId,
    title: run.workItem.title,
    attempt: run.retryOf
      ? { number: run.attempt, before: { href: `/runs/${run.retryOf}`, runId: run.retryOf } }
      : undefined,
    state: run.state,
    stateClass: `osf-state osf-state-${run.state}`,
    factory: run.factory,
    version: run.factoryVersion,
    age: age(run.startedAt, now),
    pullRequest: linkOf(run.pullRequest),
    trace: linkOf(links.trace, "trace"),
    history: linkOf(links.history, "Temporal"),
    // "Run again" for a failed or cancelled run (ADR 0105).
    retry: at.actions && (run.state === "failed" || run.state === "cancelled") ? `/runs/${run.runId}/retry` : undefined,
    signals: signalsOf(run, at.actions),
    requests: requests.map((request) => ({
      origin: linkOf(request.origin.url, request.origin.source),
      requester: request.requester.displayName ?? request.requester.id,
    })),
    stages: run.stages.map((stage) =>
      stageRow(run, stage, stage.gateId ? gates.get(stage.gateId) : undefined, links, at.actions && at.decides),
    ),
    actions: run.actions?.length
      ? run.actions.map(
          (action) =>
            `${action.type}${action.message ? `: ${action.message}` : ""} by ${action.by.displayName ?? action.by.id} at ${action.at}`,
        )
      : undefined,
  };
}
