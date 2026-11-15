// The data of the inbox page "/inbox" (src/web/pages/inbox.astro): observer's open proposals with their age and
// state (IMPROVE-004, ADR 0073), in the shell of the new look. The template only reads it.
import type { ShellData } from "@opensoftware/ui";
import type { Proposal } from "../adapters/forge.ts";
import { proposalState } from "../domain/inbox.ts";
import { age } from "../domain/runs.ts";
import { linkOf } from "./runs.ts";

export interface ProposalRow {
  /** The proposal's title, linked to its pull request when that is an http or https URL. */
  title: ReturnType<typeof linkOf>;
  branch: string;
  author: string;
  /** "needs review", "approved" or "changes requested". */
  state: string;
  /** The classes of the state: its shape and colour. */
  stateClass: string;
  age: string;
}

export interface InboxData {
  shell: ShellData;
  repository: string;
  /** Why the forge's proposals are missing. */
  notes: string[];
  rows: ProposalRow[];
  /** Whether the forge answered with no proposal. */
  empty: boolean;
}

const rowOf = (proposal: Proposal, now: number): ProposalRow => {
  const state = proposalState(proposal.review);
  return {
    title: linkOf(proposal.url, proposal.title),
    branch: proposal.head,
    author: proposal.author,
    state,
    stateClass: `osf-state osf-state-${state.replace(" ", "-")}`,
    age: age(proposal.created, now),
  };
};

export const inboxData = (
  shell: ShellData,
  repository: string,
  proposals: Proposal[],
  now: number,
  notes: string[],
): InboxData => ({
  shell,
  repository,
  notes,
  rows: proposals.map((proposal) => rowOf(proposal, now)),
  // "No open proposals" only when the forge answered.
  empty: proposals.length === 0 && notes.length === 0,
});
