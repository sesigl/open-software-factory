// @ts-nocheck
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
  /** A stage's span in the run's trace (ADR 0121). */
  span: (spanId: string) => string | undefined;
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

/** The forms that signal a running or blocked run, shown when the console takes actions (ADR 0118). */
const signalForms = (run: RunView, actions: boolean) => {
  if (!actions || (run.state !== "running" && run.state !== "blocked")) return null;
  const action = `/runs/${run.runId}/signals`;
  const button = (type: string, label: string) =>
    html`<form method="post" action=${action}>
      <input type="hidden" name="type" value=${type} />
      <button type="submit">${label}</button>
    </form>`;
  const running = run.stages.some((stage) => stage.state === "running");
  const takenOver = run.stages.some((stage) => stage.state === "blocked" && stage.takenOverAt);
  return html`<form method="post" action=${action}>
      <input type="hidden" name="type" value="steer" />
      <label>Steer <input name="message" required /></label>
      <button type="submit">Steer</button>
    </form>
    ${running ? button("take-over", "Take over") : null} ${takenOver ? button("hand-back", "Hand back") : null}
    ${button("cancel", "Cancel")}`;
};

/** The forms that approve or reject a pending gate, shown when the console takes actions with gatekeeper (ADR 0118). */
const gateForms = (run: RunView, gate: GateView | undefined, decides: boolean) =>
  decides && gate?.state === "pending"
    ? html`<form method="post" action=${`/runs/${run.runId}/gates/${gate.id}`}>
          <input type="hidden" name="decision" value="approved" />
          <button type="submit">Approve</button>
        </form>
        <form method="post" action=${`/runs/${run.runId}/gates/${gate.id}`}>
          <input type="hidden" name="decision" value="rejected" />
          <label>Reason <input name="reason" /></label>
          <button type="submit">Reject</button>
        </form>`
    : null;

/** The signals people sent the run, with who sent them (ADR 0118). */
const actionList = (run: RunView) =>
  run.actions?.length
    ? html`<h2>Actions</h2>
        <ul>
          ${run.actions.map(
            (action) =>
              html`<li>${action.type}${action.message ? `: ${action.message}` : ""} by ${action.by.displayName ?? action.by.id} at ${action.at}</li>`,
          )}
        </ul>`
    : null;

/** The attempt and the run before, for a run that a person ran again. */
const runBefore = (run: RunView) =>
  run.retryOf
    ? html`<dt>Attempt</dt>
        <dd>Attempt ${run.attempt}, after <a href=${`/runs/${run.retryOf}`}>${run.retryOf}</a></dd>`
    : null;

/** The stage's name, linked to its span when the run's trace and the stage's span are known (ADR 0121). */
const spanLink = (stage: StageView, links: RunLinks) => {
  const url = stage.spanId ? links.span(stage.spanId) : undefined;
  return url ? linkOr(url, stage.stage) : stage.stage;
};

const stageRow = (stage: StageView, gates: Map<string, GateView>, links: RunLinks, gate: unknown) => html`<tr>
  <td>${spanLink(stage, links)}</td>
  <td>${stage.wait ? "waits" : stage.agent}</td>
  <td>${stage.state}</td>
  <td>${stage.sessionId ? linkOr(links.transcript(stage.sessionId), stage.sessionId) : ""}</td>
  <td>${gateText(stage, gates)} ${gate}</td>
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
  decides = false,
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
    ${retryForm(run, actions)} ${signalForms(run, actions)}
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
        ${run.stages.map((stage) =>
          stageRow(
            stage,
            gates,
            links,
            gateForms(run, stage.gateId ? gates.get(stage.gateId) : undefined, actions && decides),
          ),
        )}
      </tbody>
    </table>
    ${actionList(run)}`;
}
