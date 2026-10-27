// The inbox page "/inbox": observer's open proposals with their age and state (IMPROVE-004, ADR 0073).
import type { Proposal } from "../adapters/forge.ts";
import { proposalState } from "../domain/inbox.ts";
import { age } from "../domain/runs.ts";
import { html, linkOr } from "./html.ts";

export function inboxPage(repository: string, proposals: Proposal[], now: number) {
  return html`<h1>Inbox</h1>
    <p>The open proposals in ${repository}.</p>
    <table>
      <thead>
        <tr>
          <th>Proposal</th>
          <th>Branch</th>
          <th>Author</th>
          <th>State</th>
          <th>Age</th>
        </tr>
      </thead>
      <tbody>
        ${proposals.map(
          (proposal) => html`<tr>
            <td>${linkOr(proposal.url, proposal.title)}</td>
            <td>${proposal.head}</td>
            <td>${proposal.author}</td>
            <td>${proposalState(proposal.review)}</td>
            <td>${age(proposal.created, now)}</td>
          </tr>`,
        )}
      </tbody>
    </table>`;
}
