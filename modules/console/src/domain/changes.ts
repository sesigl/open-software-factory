// The changes of the factory that the console proposes as pull requests (ADR 0144): the edits of `factory edit`, the
// check of a form's text before any program sees it, the pull request's title that is the edit's line for a program,
// its branch, body and commit message, and the state of a change from what the forge port prints. Without I/O.
import { createHash } from "node:crypto";

/** The edits of factory-spec's `factory edit` (modules/factory-spec/README.md). */
export const EDITS = [
  "add-skill",
  "remove-skill",
  "add-secret",
  "remove-secret",
  "add-egress",
  "remove-egress",
  "add-secrets-provider",
] as const;

export type EditName = (typeof EDITS)[number];

/** One edit: its name, the agent (or the provider's name) and the value (or the provider's range). */
export interface Edit {
  edit: EditName;
  target: string;
  value: string;
}

/** The text of a form or a title that is checked, or why it was refused. */
export type Checked = { ok: true; edit: Edit } | { ok: false; reason: string };

const LABEL = "[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?";
const HOST = new RegExp(`^(?=.{1,253}$)${LABEL}(\\.${LABEL})*$`);
const NAME = /^[a-z][a-z0-9-]{0,62}$/;
const AGENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/;
const REFERENCE = /^ref:[a-z][a-z0-9-]*\/[A-Za-z0-9_./-]{1,200}$/;
const SKILL = /^(\.\/)?[A-Za-z0-9_][A-Za-z0-9_./-]{0,200}$/;
// Without a space: the title is the edit's line of three words, which "Try again" reads again.
const RANGE = /^[0-9A-Za-z^~<>=.*|-]{1,64}$/;

const skill = {
  valid: (value: string) => SKILL.test(value) && !value.split("/").includes(".."),
  what: "skill folder, like skills/release-notes",
};
const reference = {
  valid: (value: string) => REFERENCE.test(value),
  what: "secret reference, like ref:openbao/linear-token",
};
const host = { valid: (value: string) => HOST.test(value), what: "host name, like api.linear.app" };

/** What each value must be, and the example its refusal names. */
const VALUES: Record<EditName, { valid: (value: string) => boolean; what: string }> = {
  "add-skill": skill,
  "remove-skill": skill,
  "add-secret": reference,
  "remove-secret": reference,
  "add-egress": host,
  "remove-egress": host,
  "add-secrets-provider": { valid: (value) => RANGE.test(value) && /[0-9*]/.test(value), what: "range, like ^0" },
};

const isEdit = (name: string): name is EditName => (EDITS as readonly string[]).includes(name);

const article = (what: string) => (/^[aeiou]/.test(what) ? "an" : "a");

/** Checks the three words of an edit: the edit, the agent or the provider's name, and the value. */
export function checkEdit(edit: string, target: string, value: string): Checked {
  if (!isEdit(edit)) return { ok: false, reason: `${edit || "no edit"} is not an edit: ${EDITS.join(", ")}` };
  const provider = edit === "add-secrets-provider";
  if (!(provider ? NAME : AGENT).test(target))
    return {
      ok: false,
      reason: `${target || "nothing"} is not ${provider ? "a provider's name, like openbao" : "an agent's name, like triage"}`,
    };
  const { valid, what } = VALUES[edit];
  if (!valid(value)) return { ok: false, reason: `${value || "nothing"} is not ${article(what)} ${what}` };
  return { ok: true, edit: { edit, target, value } };
}

/** The edit of a form: "edit", and "agent" and "value", or "name" and "range" for a secrets provider. */
export function editOfForm(fields: Record<string, unknown>): Checked {
  const field = (name: string) => String(fields[name] ?? "").trim();
  const edit = field("edit");
  return edit === "add-secrets-provider"
    ? checkEdit(edit, field("name"), field("range"))
    : checkEdit(edit, field("agent"), field("value"));
}

const TITLE = "factory edit ";

/** The pull request's title: the command line of the edit, the line a program reads again (ADR 0144). */
export const titleOf = ({ edit, target, value }: Edit): string => `${TITLE}${edit} ${target} ${value}`;

/** The edit of a pull request's title, checked like a form, or why it is none. */
export function editOfTitle(title: string): Checked {
  const words = title.startsWith(TITLE) ? title.slice(TITLE.length).split(" ") : [];
  if (words.length !== 3) return { ok: false, reason: `the title "${title}" is not a line of factory edit` };
  const [edit, target, value] = words as [string, string, string];
  return checkEdit(edit, target, value);
}

/** What the edit changes, as a sentence, with each word of the form wrapped by `name`. */
export function sentenceOf({ edit, target, value }: Edit, name: (text: string) => string = (text) => text): string {
  const agent = `The agent ${name(target)}`;
  const sentences: Record<EditName, string> = {
    "add-skill": `${agent} gets the skill ${name(value)}.`,
    "remove-skill": `${agent} no longer has the skill ${name(value)}.`,
    "add-secret": `${agent} gets the secret reference ${name(value)}.`,
    "remove-secret": `${agent} no longer has the secret reference ${name(value)}.`,
    "add-egress": `${agent} may reach the host ${name(value)}.`,
    "remove-egress": `${agent} may no longer reach the host ${name(value)}.`,
    "add-secrets-provider": `The factory declares the secrets provider ${name(target)} at ${name(value)}.`,
  };
  return sentences[edit];
}

/** The first 8 hexadecimal digits of the SHA-256 of the edit's three words. */
export const hashOf = ({ edit, target, value }: Edit): string =>
  createHash("sha256").update(`${edit}\n${target}\n${value}`).digest("hex").slice(0, 8);

export const PREFIX = "console/";

/** The branch of the edit on this commit: "console/<edit>-<agent>-<commit>-<hash of the edit>". */
export function branchOf(edit: Edit, commit: string): string {
  const what = `${edit.edit}-${edit.target.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  return `${PREFIX}${what}-${commit.slice(0, 7)}-${hashOf(edit)}`;
}

/** A text in Markdown with each character escaped that could start a link, an emphasis, a tag or a table cell. */
export const markdownText = (text: string): string => text.replace(/[\\`*_{}[\]()#+\-!|<>~&]/g, (char) => `\\${char}`);

/** A checked value in a code span: it holds no backtick. */
const code = (text: string): string => `\`${text}\``;

/** The person as one line: no line break or control character reaches a trailer or the body. */
const oneLine = (text: string): string => text.replace(/\p{Cc}/gu, " ");

/** The body of the pull request: what changes, who asked for it, and when it is live. */
export const bodyOf = (edit: Edit, person: string, branch: string): string =>
  [
    sentenceOf(edit, code),
    "",
    `${markdownText(oneLine(person))} asked for this change of the factory in the console.`,
    "",
    `The forge merges it into ${code(branch)} when the check \`factory\` passes. A run keeps the factory version it started with, so the change is live for the next run.`,
    "",
  ].join("\n");

/** The commit message: the title, and the person in the trailer "Requested-by". */
export const messageOf = (edit: Edit, person: string): string =>
  `${titleOf(edit)}\n\nRequested-by: ${oneLine(person)}\n`;

/** A pull request as the forge port's `prs` prints it. */
export interface Listed {
  number: number;
  url: string;
  title: string;
  state: "open" | "closed" | "merged";
  head: string;
  author: string;
  mergeCommit?: string | null;
}

/** A pull request as the forge port's `pr` prints it. */
export interface Pull extends Listed {
  mergeable: boolean;
  checks: { name: string; state: string; url?: string }[];
}

export type ChangeState = "live" | "discarded" | "conflict" | "failed" | "ready" | "checking";

/** The check whose result the console relies on (ADR 0144). */
export const CHECK = "factory";

/**
 * Whether the pull request is a change of the console: the console's token's user opened it from a branch
 * "console/...", or it is closed, its branch is gone (Forgejo then names the head "refs/pull/<n>/head") and its title is
 * a line of `factory edit`.
 */
export const isChange = (pull: Pick<Listed, "head" | "author" | "state" | "title">, user: string): boolean =>
  pull.author === user &&
  (pull.head.startsWith(PREFIX) ||
    (pull.state !== "open" && /^refs\/pull\/\d+\/head$/.test(pull.head) && editOfTitle(pull.title).ok));

/** The state of a change: from `prs` for a closed one, from `pr` for an open one. */
export function stateOf(pull: Listed | Pull): ChangeState {
  if (pull.state === "merged") return "live";
  if (pull.state === "closed") return "discarded";
  const { mergeable, checks } = pull as Pull;
  if (!mergeable) return "conflict";
  if (failedOf(pull as Pull).length > 0) return "failed";
  return checks.some((check) => check.name === CHECK && check.state === "success") ? "ready" : "checking";
}

/** The checks of the pull request that failed. */
export const failedOf = (pull: Pull): string[] =>
  pull.checks.filter((check) => check.state === "failure" || check.state === "error").map((check) => check.name);

/** The states that offer each button. */
export const BUTTONS: Record<"retry" | "discard" | "merge", ChangeState[]> = {
  retry: ["failed", "conflict"],
  discard: ["failed", "conflict"],
  merge: ["ready"],
};

/** The owner and the name of the repository of a URL like https://forge.example/acme/factory.git. */
export function repositoryOf(url: string): string | undefined {
  const parts = url
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .split("/");
  const [owner, name] = parts.slice(-2);
  return parts.length >= 5 && owner && name ? `${owner}/${name}` : undefined;
}
