// The run page "/runs/<runId>": the run's origin and requests, its stages with their gates and checks as its
// evidence, and links to its pull request, trace, transcripts and history (VIS-002).
import type { GateView, RunView, StageView, WorkRequest } from "@opensoftware/contracts";
import { age } from "../domain/runs.ts";
import { html, linkOr } from "./html.ts";

export interface RunLinks {
  trace?: string;
  history?: string;
  /** A stage's transcript, by its harness session. */
  transcript: (sessionId: string) => string | undefined;
}

const gateText = (stage: StageView, gates: Map<string, GateView>) => {
  const gate = stage.gateId ? gates.get(stage.gateId) : undefined;
  if (!gate) return stage.gateId ?? "";
  const waiting = gate.waitingFor?.length ? `, waiting for ${gate.waitingFor.join(", ")}` : "";
  return `${gate.id} ${gate.state}${waiting}`;
};

/** The form "run again", shown when the console takes actions and the run failed or was cancelled (ADR 0105). */
const retryForm = (run: RunView, actions: boolean) =>
  actions && (run.state === "failed" || run.state === "cancelled")
    ? html`<form method="post" action=${`/runs/${run.runId}/retry`}>
        <button type="submit">Run again</button>
      </form>`
    : null;

/** The attempt and the run before, for a run that a person ran again. */
const runBefore = (run: RunView) =>
  run.retryOf
    ? html`<dt>Attempt</dt>
        <dd>Attempt ${run.attempt}, after <a href=${`/runs/${run.retryOf}`}>${run.retryOf}</a></dd>`
    : null;

const stageRow = (stage: StageView, gates: Map<string, GateView>, links: RunLinks) => html`<tr>
  <td>${stage.stage}</td>
  <td>${stage.agent ?? "waits"}</td>
  <td>${stage.state}</td>
  <td>${stage.sessionId ? linkOr(links.transcript(stage.sessionId), stage.sessionId) : ""}</td>
  <td>${gateText(stage, gates)}</td>
  <td>${(stage.checks ?? []).map((check) => `${check.name}: ${check.state}`).join(", ")}</td>
  <td>${stage.reason ?? ""}</td>
</tr>`;

export function runPage(
  run: RunView,
  requests: WorkRequest[],
  gates: Map<string, GateView>,
  links: RunLinks,
  now: number,
  actions: boolean,
) {
  return html`<h1>${run.workItem.title}</h1>
    <dl>
      <dt>Run</dt>
      <dd>${run.runId}</dd>
      ${runBefore(run)}
      <dt>State</dt>
      <dd>${run.state}</dd>
      <dt>Factory</dt>
      <dd>${run.factory} at ${run.factoryVersion}</dd>
      <dt>Age</dt>
      <dd>${age(run.startedAt, now)}</dd>
      <dt>Pull request</dt>
      <dd>${linkOr(run.pullRequest, run.pullRequest ?? "")}</dd>
      <dt>Trace</dt>
      <dd>${linkOr(links.trace, "trace")}</dd>
      <dt>History</dt>
      <dd>${linkOr(links.history, "Temporal")}</dd>
    </dl>
    ${retryForm(run, actions)}
    <h2>Origin</h2>
    <ul>
      ${requests.map(
        (request) =>
          html`<li>${linkOr(request.origin.url, request.origin.source)} asked by ${request.requester.displayName ?? request.requester.id}</li>`,
      )}
    </ul>
    <h2>Evidence</h2>
    <table>
      <thead>
        <tr>
          <th>Stage</th>
          <th>Agent</th>
          <th>State</th>
          <th>Transcript</th>
          <th>Gate</th>
          <th>Checks</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        ${run.stages.map((stage) => stageRow(stage, gates, links))}
      </tbody>
    </table>`;
}
