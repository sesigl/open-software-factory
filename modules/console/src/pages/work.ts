// The work page "/work": intake's latest work items, each with its origin, status, requester, run and age, so a person
// sees the work that waits, also work without a run yet.
import type { WorkItemView } from "@opensoftware/contracts";
import { age } from "../domain/runs.ts";
import { html, linkOr, nextLink } from "./html.ts";

/** The form "submit work", shown when the console takes actions (ADR 0089). */
const submitForm = html`<form method="post" action="/work">
  <fieldset>
    <legend>Submit work</legend>
    <label>Title <input name="title" required maxlength="300" /></label>
    <label
      >Type
      <select name="type">
        <option value="task">task</option>
        <option value="bug">bug</option>
        <option value="idea">idea</option>
        <option value="automation">automation</option>
      </select>
    </label>
    <label>Description <textarea name="description"></textarea></label>
  </fieldset>
  <button type="submit">Submit</button>
</form>`;

export function workPage(items: WorkItemView[], now: number, actions = false, next?: string) {
  return html`<h1>Work</h1>
    ${actions ? submitForm : null}
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
    </table>
    ${nextLink(next)}`;
}
