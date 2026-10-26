// The runs page "/": every run of every foreman, with a filter per state (VIS-001, ORCH-008).
import type { RunView } from "@opensoftware/contracts";
import { age, STATES } from "../domain/runs.ts";
import { html, linkOr } from "./html.ts";

export function runsPage(runs: RunView[], state: string | undefined, now: number) {
  return html`<h1>Runs</h1>
    <nav>
      <ul>
        <li><a href="/" aria-current=${state ? undefined : "page"}>all</a></li>
        ${STATES.map(
          (each) =>
            html`<li><a href=${`?state=${each}`} aria-current=${each === state ? "page" : undefined}>${each}</a></li>`,
        )}
      </ul>
    </nav>
    <table>
      <thead>
        <tr>
          <th>Run</th>
          <th>Factory</th>
          <th>State</th>
          <th>Source</th>
          <th>Requester</th>
          <th>Pull request</th>
          <th>Age</th>
        </tr>
      </thead>
      <tbody>
        ${runs.map(
          (run) => html`<tr>
            <td><a href=${`/runs/${run.runId}`}>${run.workItem.title}</a></td>
            <td>${run.factory}</td>
            <td>${run.state}</td>
            <td>${run.workItem.origin.source}</td>
            <td>${run.workItem.requester.displayName ?? run.workItem.requester.id}</td>
            <td>${linkOr(run.pullRequest, run.pullRequest ?? "")}</td>
            <td>${age(run.startedAt, now)}</td>
          </tr>`,
        )}
      </tbody>
    </table>`;
}
