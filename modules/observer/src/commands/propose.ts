// observer propose: one problem in, a pull request with the model's fix out. Nothing is pushed unless every edit
// applies, and only to observer's own branch.
import { UsageError } from "@opensoftware/cli";
import { writeJson } from "../adapters/files.ts";
import { openPullRequest } from "../adapters/forge.ts";
import { complete } from "../adapters/gateway.ts";
import { clone } from "../adapters/git.ts";
import { repositoryOf } from "../domain/forge-url.ts";
import type { Problem } from "../domain/problems.ts";
import { applyEdits, branchOf, MIN_EVIDENCE, promptOf, proposalOf, pullRequestOf } from "../domain/proposal.ts";

export interface ProposeOptions {
  repo: string;
  files: string[];
  model: string;
  gateway: { url: string; key: string | undefined };
  forge: { api: string | undefined; token: string | undefined };
  out: string;
}

export function pickProblem(problems: Problem[], id: string | undefined, file: string): Problem {
  const problem = id === undefined ? problems[0] : problems.find((candidate) => candidate.id === id);
  if (!problem)
    throw new UsageError(
      `no problem${id === undefined ? "" : ` "${id}"`} in ${file}; it has: ${problems.map((p) => p.id).join(", ") || "none"}`,
    );
  if (problem.runs.length < MIN_EVIDENCE)
    throw new Error(
      `the problem ${problem.id} has ${problem.runs.length} failed run; a proposal needs at least ${MIN_EVIDENCE}`,
    );
  return problem;
}

export async function propose(problem: Problem, options: ProposeOptions): Promise<string[]> {
  const ref = repositoryOf(options.repo, options.forge.api);
  const repository = await clone(ref.cloneUrl, options.forge.token);
  try {
    const files = options.files.map((path) => ({ path, text: repository.read(path) ?? "(no such file yet)" }));
    const proposal = proposalOf(await complete(options.gateway, options.model, promptOf(problem, files)));
    const changed = applyEdits(proposal.edits, repository.read);
    const branch = branchOf(problem, proposal.edits);
    const pull = pullRequestOf(problem, proposal, [...changed.keys()]);
    await repository.push(branch, pull.title, changed);
    const url = await openPullRequest(ref, options.forge.token, { ...pull, head: branch, base: repository.base });
    writeJson(options.out, { problem: problem.id, pullRequest: url, branch, base: repository.base, ...pull });
    return [`opened ${url}`, `wrote ${options.out}`];
  } finally {
    repository.close();
  }
}
