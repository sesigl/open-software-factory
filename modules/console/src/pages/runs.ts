// The data of the runs page "/" (src/web/pages/runs.astro): every run of every foreman, with a filter per state
// (VIS-001, ORCH-008), in the shell of the new look (ADR 0133). The template only reads it.
import type { RunView } from "@opensoftware/contracts";
import type { ShellData } from "@opensoftware/ui";
import { age, STATES } from "../domain/runs.ts";

export interface RunRow {
  title: string;
  href: string;
  factory: string;
  state: string;
  /** The classes of the state: its shape and colour. */
  stateClass: string;
  /** The class of a row that waits for a person. */
  rowClass: string | undefined;
  source: string;
  requester: string;
  /** The pull request: a link for an http or https URL, else its text, and a dash without one. */
  pullRequest: { href?: string; text: string };
  age: string;
}

export interface RunsData {
  shell: ShellData;
  /** The link "all" and one per state, the current one marked. */
  filters: { name: string; href: string; current?: "page" }[];
  /** Why a foreman's runs are missing. */
  notes: string[];
  rows: RunRow[];
  empty: boolean;
  /** Whether the page offers "Submit work": only with intake's API. */
  work: boolean;
  next?: string;
}

const linkOf = (url: string | undefined): RunRow["pullRequest"] => {
  if (!url) return { text: "—" };
  return /^https?:\/\//i.test(url) ? { href: url, text: url } : { text: url };
};

const rowOf = (run: RunView, now: number): RunRow => ({
  title: run.workItem.title,
  href: `/runs/${run.runId}`,
  factory: run.factory,
  state: run.state,
  stateClass: `osf-state osf-state-${run.state}`,
  rowClass: run.state === "blocked" ? "osf-waits" : undefined,
  source: run.workItem.origin.source,
  requester: run.workItem.requester.displayName ?? run.workItem.requester.id,
  pullRequest: linkOf(run.pullRequest),
  age: age(run.startedAt, now),
});

/** The count beside "Runs": the runs of this page that wait for a person, when the page shows them. */
export function waitingOf(runs: RunView[], state: string | undefined): string | undefined {
  if (state !== undefined && state !== "blocked") return undefined;
  const count = runs.filter((run) => run.state === "blocked").length;
  return count ? `${count} waits` : undefined;
}

export function runsData(
  shell: ShellData,
  runs: RunView[],
  state: string | undefined,
  now: number,
  at: { notes: string[]; work: boolean; next?: string },
): RunsData {
  return {
    shell,
    filters: [
      { name: "all", href: "/", ...(state ? {} : { current: "page" as const }) },
      ...STATES.map((each) => ({
        name: each,
        href: `?state=${each}`,
        ...(each === state ? { current: "page" as const } : {}),
      })),
    ],
    notes: at.notes,
    rows: runs.map((run) => rowOf(run, now)),
    empty: runs.length === 0,
    work: at.work,
    ...(at.next ? { next: at.next } : {}),
  };
}
