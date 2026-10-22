// A proposal: the prompt for the model, the model's answer as edits, the edited files, the branch and the pull
// request text. No input or output here; the commands read the files and call the model and the forge.
import { createHash } from "node:crypto";
import { isAbsolute, normalize } from "node:path";
import { percent } from "./present.ts";
import type { Problem } from "./problems.ts";

export interface Edit {
  path: string;
  /** Text that occurs exactly once in the file; empty to create a new file. */
  old: string;
  new: string;
}

export interface Proposal {
  solution: string;
  edits: Edit[];
}

/** A proposal needs failed runs from at least this many distinct runs (backpass's evidence gate). */
export const MIN_EVIDENCE = 2;

/** The most failed runs the Evidence section lists. */
const EVIDENCE_RUNS = 20;

const INSTRUCTIONS = `You improve the instruction files of the coding agents of a software factory.
A scorer judged agent runs and found a repeated failure. Propose the smallest change to the files below that
prevents it. Answer with one JSON object and nothing else:
{"solution": "<one or two sentences: what the change does and why>",
 "edits": [{"path": "<file path>", "old": "<exact text that occurs once in the file>", "new": "<its replacement>"}]}
An empty "old" creates a new file with the text "new".`;

/** The chat messages for the model: the instructions, then the problem and the files. */
export function promptOf(problem: Problem, files: { path: string; text: string }[]) {
  const reasons = problem.reasons.map(({ reason, count }) => `- ${reason} (${count} runs)`);
  const user = [
    `Problem: the scorer ${problem.id} failed ${problem.failures} of ${problem.scored} runs.`,
    "Reasons:",
    ...reasons,
    "",
    ...files.flatMap(({ path, text }) => [`File ${path}:`, "```", text, "```", ""]),
  ].join("\n");
  return [
    { role: "system", content: INSTRUCTIONS },
    { role: "user", content: user },
  ];
}

/** The model's answer as a proposal; it may sit in a Markdown code fence. */
export function proposalOf(answer: string): Proposal {
  const value = parsed(/```(?:json)?\s*\n([\s\S]*?)```/.exec(answer)?.[1] ?? answer);
  const edits: Partial<Edit>[] = Array.isArray(value?.edits) ? value.edits : [];
  const valid = edits.every(
    (edit) =>
      typeof edit.path === "string" && edit.path && typeof edit.old === "string" && typeof edit.new === "string",
  );
  const solution = typeof value?.solution === "string" ? value.solution.trim() : "";
  if (!solution || !edits.length || !valid)
    throw new Error(`the model's answer is no proposal with "solution" and "edits": ${answer.slice(0, 200)}`);
  return { solution, edits: edits as Edit[] };
}

function parsed(text: string): { solution?: unknown; edits?: unknown } | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The new text of every edited file. `read` gives a file's text, or undefined when there is no such file.
 * Edits of one file apply in order.
 */
export function applyEdits(edits: Edit[], read: (path: string) => string | undefined): Map<string, string> {
  const files = new Map<string, string>();
  for (const edit of edits) {
    const path = normalize(edit.path);
    const fail = (why: string) => new Error(`the edit of ${edit.path} does not apply: ${why}`);
    if (isAbsolute(path) || path.startsWith("..")) throw fail("the path leaves the repository");
    const text = files.get(path) ?? read(path);
    if (edit.old === "") {
      if (text !== undefined) throw fail('the file exists, and an empty "old" only creates a file');
      files.set(path, edit.new);
      continue;
    }
    const count = text?.split(edit.old).length ?? 1;
    if (count !== 2)
      throw fail(`the text "${edit.old}" is ${count === 1 ? "not in the file" : `in the file ${count - 1} times`}`);
    files.set(
      path,
      (text as string).replace(edit.old, () => edit.new),
    );
  }
  return files;
}

/** Paths that change checks, approvals or ownership: a person who owns the factory reviews them. */
export const isProtected = (path: string): boolean =>
  path.startsWith(".github/") || path.endsWith(".rego") || /(^|\/)CODEOWNERS$/.test(path);

/** A branch of observer's own, named after the problem and the change. */
export const branchOf = (problem: Problem, edits: Edit[]): string =>
  `observer/${problem.id}-${createHash("sha256").update(JSON.stringify(edits)).digest("hex").slice(0, 8)}`;

export function pullRequestOf(problem: Problem, proposal: Proposal, paths: string[]) {
  const guarded = paths.filter(isProtected);
  const title = `${guarded.length ? "[needs human] " : ""}observer: ${problem.id} failed ${problem.failures} of ${problem.scored} runs`;
  const evidence = problem.runs
    .slice(0, EVIDENCE_RUNS)
    .map((run) => `- ${[run.run, `(${run.time}):`, run.reason, ...run.links].filter(Boolean).join(" ")}`);
  const more = problem.runs.length - evidence.length;
  const body = [
    "## Problem",
    "",
    `The scorer \`${problem.id}\` failed ${problem.failures} of ${problem.scored} runs (${percent(problem.failureRate)}).`,
    "",
    ...problem.reasons.slice(0, 5).map(({ reason, count }) => `- ${reason} (${count} runs)`),
    "",
    "## Solution",
    "",
    proposal.solution,
    "",
    ...paths.map((path) => `- \`${path}\``),
    "",
    ...(guarded.length ? [`needs human: the change touches the protected path ${guarded.join(", ")}`, ""] : []),
    "## Evidence",
    "",
    ...evidence,
    ...(more ? [`- and ${more} more failed runs`] : []),
    "",
    "After the merge, check the effect with the same scorer:",
    "",
    "```sh",
    `observer check --problem ${problem.id} --pull-request <this pull request's URL> <scores>`,
    "```",
    "",
  ].join("\n");
  return { title, body };
}
