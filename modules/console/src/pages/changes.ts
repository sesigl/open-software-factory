// The data of the page "/changes" (src/web/pages/changes.astro), in the shell of the new look (ADR 0133, ADR 0144):
// the console's changes with their states and buttons, and the forms that propose one. Every value is text that the
// template escapes.
import type { ShellData } from "@opensoftware/ui";
import {
  BUTTONS,
  CHECK,
  type ChangeState,
  editOfTitle,
  failedOf,
  type Listed,
  type Pull,
  sentenceOf,
  stateOf,
} from "../domain/changes.ts";

export interface ChangeRow {
  /** What changes, as a sentence, or the title as it is when it is no line of `factory edit`. */
  text: string;
  state: string;
  stateClass: string;
  detail: string;
  link: { href: string; text: string };
  /** The buttons of a person with the role, each a form that posts to its action. */
  buttons: { action: string; name: string }[];
}

export interface ChangesData {
  shell: ShellData;
  /** Why the console cannot change this factory, or undefined when it can. */
  closed: string | undefined;
  notes: string[];
  rows: ChangeRow[];
  empty: boolean;
  /** The forms that propose a change, for a person with the role; the agents of the factory to choose from. */
  form: { agents: string[]; edits: { value: string; label: string }[] } | undefined;
}

const LOOKS: Record<ChangeState, { state: string; shape: string }> = {
  live: { state: "Live", shape: "complete" },
  discarded: { state: "Discarded", shape: "cancelled" },
  conflict: { state: "Conflict", shape: "failed" },
  failed: { state: "Failed", shape: "failed" },
  ready: { state: "Ready", shape: "blocked" },
  checking: { state: "Checking", shape: "running" },
};

/** The edits of an agent that the form offers, by the words of `factory edit`. */
const EDIT_LABELS = [
  { value: "add-egress", label: "Add an egress host" },
  { value: "remove-egress", label: "Remove an egress host" },
  { value: "add-secret", label: "Add a secret reference" },
  { value: "remove-secret", label: "Remove a secret reference" },
  { value: "add-skill", label: "Add a skill" },
  { value: "remove-skill", label: "Remove a skill" },
];

const BUTTON_NAMES = { retry: "Try again", discard: "Discard", merge: "Merge" } as const;

/** The checks as words: "The check factory failed." or "The checks lint and factory failed." */
function failedText(names: string[]): string {
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return `The check${names.length > 1 ? "s" : ""} ${list} failed.`;
}

function detailOf(state: ChangeState, pull: Listed | Pull, branch: string): string {
  if (state === "live") return `Live for the next run: factory version ${(pull.mergeCommit ?? "").slice(0, 7)}`;
  if (state === "discarded") return "Closed without a merge.";
  if (state === "conflict") return `It conflicts with a newer commit of ${branch}. Try it again on the newest commit.`;
  if (state === "failed") return failedText(failedOf(pull as Pull));
  if (state === "ready") return `The check ${CHECK} passed. Merge it to make it live for the next run.`;
  return `Waits for the check ${CHECK}; the forge merges it when it passes.`;
}

/** The row of a change; `act` says whether the person may press its buttons. */
export function changeRow(pull: Listed | Pull, branch: string, act: boolean): ChangeRow {
  const state = stateOf(pull);
  const edit = editOfTitle(pull.title);
  const buttons = (Object.keys(BUTTONS) as (keyof typeof BUTTONS)[])
    .filter((button) => act && BUTTONS[button].includes(state))
    .map((button) => ({ action: `/changes/${pull.number}/${button}`, name: BUTTON_NAMES[button] }));
  return {
    text: edit.ok ? sentenceOf(edit.edit) : pull.title,
    state: LOOKS[state].state,
    stateClass: `osf-state osf-state-${LOOKS[state].shape}`,
    detail: detailOf(state, pull, branch),
    link: { href: pull.url, text: `Pull request #${pull.number}` },
    buttons,
  };
}

/** Whether a change still waits for its check, so that the page reloads itself. */
export const checking = (pulls: (Listed | Pull)[]): boolean => pulls.some((pull) => stateOf(pull) === "checking");

/** The page; `agents` are the factory's agents for the form of a person with the role, or undefined without it. */
export function changesData(
  shell: ShellData,
  closed: string | undefined,
  rows: ChangeRow[],
  notes: string[],
  agents: string[] | undefined,
): ChangesData {
  return {
    shell,
    closed,
    notes,
    rows,
    empty: rows.length === 0,
    form: closed || !agents ? undefined : { agents, edits: EDIT_LABELS },
  };
}
