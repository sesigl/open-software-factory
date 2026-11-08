// The work page "/work": intake's latest work items, each with its origin, status, requester, run and age, so a person
// sees the work that waits, also work without a run yet.
import type { WorkItemView } from "@opensoftware/contracts";
import { age } from "../domain/runs.ts";
import { html, linkOr } from "./html.ts";

export function workPage(items: WorkItemView[], now: number) {
  return html`<h1>Work</h1>
    <p>The latest work items, the one received last first.</p>
    <table>
      <thead>
        <tr>
          <th>Work item</th>
          <th>Type</th>
          <th>Status</th>
          <th>Source</th>
          <th>Requester</th>
          <th>Run</th>
          <th>Age</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(
          ({ workItem, status, runId, receivedAt }) => html`<tr>
            <td>${linkOr(workItem.origin.url, workItem.title)}</td>
            <td>${workItem.type}</td>
            <td>${status}</td>
            <td>${workItem.origin.source}</td>
            <td>${workItem.requester.displayName ?? workItem.requester.id}</td>
            <td>${runId ? html`<a href=${`/runs/${runId}`}>${runId}</a>` : "—"}</td>
            <td>${age(receivedAt, now)}</td>
          </tr>`,
        )}
      </tbody>
    </table>`;
}
