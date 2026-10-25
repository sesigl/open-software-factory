// pr, check, comment, protect and merge: the merge state of a pull request and what changes it.
import { check as ensure, type Outcome } from "@opensoftware/cli";
import { type GitHub, GitHubError } from "../adapters/github.ts";
import { CHECK_STATES, type CommentJson, commentLine, MERGE_METHODS, protection } from "../domain/repository.ts";
import type { PullJson } from "./branches.ts";
import { connect, count, numberOf, print } from "./shared.ts";

/** GitHub computes whether a new pull request can merge in the background; pr asks again this long. */
const COMPUTE_MS = 10_000;
const PAUSE_MS = 250;
/** GitHub's answer for a pull request that conflicts with its base. */
const CONFLICT = "Pull Request is not mergeable";

/** The first 100 files a pull request changes, the most a policy reads (ADR 0061). */
const PATHS = 100;
/** The user of an Actions token, which GitHub does not let read GET /user. */
const ACTIONS_USER = "github-actions[bot]";

/** Runs a call about the pull request and names a pull request the repository does not have. */
async function about<T>(repo: string, number: number, call: () => Promise<T>): Promise<T> {
  return call().catch((error: unknown) => {
    if (error instanceof GitHubError && error.status === 404) throw new Error(`no pull request ${repo}#${number}`);
    throw error;
  });
}

/** The pull request once GitHub knows whether it can merge, or as it is after 10 seconds. */
async function computed(api: GitHub, repo: string, number: number): Promise<PullJson> {
  const deadline = Date.now() + COMPUTE_MS;
  for (;;) {
    const pull = await about(repo, number, () => api.request<PullJson>("GET", `/pulls/${number}`));
    if (pull.mergeable !== null || pull.state !== "open" || Date.now() >= deadline) return pull;
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
}

/** pr <repo> <number>: the state, whether it can merge, the commits and the checks of the head commit. */
export async function pr(repo: string | undefined, number: string | undefined): Promise<Outcome> {
  const api = connect(repo);
  const issue = numberOf(number);
  const pull = await computed(api, repo as string, issue);
  const files = await api.request<{ filename: string }[]>("GET", `/pulls/${issue}/files?per_page=${PATHS}`);
  const status = await api.request<{
    statuses: { context: string; state: string; description: string | null; target_url: string | null }[];
  }>("GET", `/commits/${pull.head.sha}/status`);
  return print({
    number: pull.number,
    url: pull.html_url,
    title: pull.title,
    state: pull.merged ? "merged" : pull.state,
    mergeable: pull.mergeable === true,
    head: pull.head.ref,
    base: pull.base.ref,
    sha: pull.head.sha,
    // While it is open, GitHub's merge_commit_sha is a test merge, not a commit on the base branch.
    mergeCommit: pull.merged ? pull.merge_commit_sha : null,
    author: `github:${pull.user.login}`,
    labels: (pull.labels ?? []).map((label) => label.name),
    draft: pull.draft === true,
    paths: files.map((file) => file.filename),
    checks: status.statuses.map((entry) => ({
      name: entry.context,
      state: entry.state,
      description: entry.description ?? "",
      url: entry.target_url ?? "",
    })),
  });
}

/** check <repo> <sha> <name> <state> [--description <text>] [--url <url>]: a commit status named after the check. */
export async function check(
  repo: string | undefined,
  sha: string | undefined,
  name: string | undefined,
  state: string | undefined,
  options: { description?: string; url?: string },
): Promise<Outcome> {
  const api = connect(repo);
  ensure(sha && name, "name the commit and the check, like check tester/web 9b1c2d3 verify success");
  ensure((CHECK_STATES as readonly string[]).includes(state ?? ""), `the state is one of ${CHECK_STATES.join(", ")}`);
  await api.request("POST", `/statuses/${sha}`, {
    state,
    context: name,
    description: options.description ?? null,
    target_url: options.url ?? null,
  });
  return print({ name, state });
}

/** comment <repo> <number> <text>: a comment on the pull request's conversation. */
export async function comment(
  repo: string | undefined,
  number: string | undefined,
  text: string | undefined,
): Promise<Outcome> {
  const api = connect(repo);
  const issue = numberOf(number);
  ensure(text, "give the comment's text, like comment tester/web 7 'Evidence attached'");
  const posted = await about(repo as string, issue, () =>
    api.request<{ id: number; html_url: string }>("POST", `/issues/${issue}/comments`, { body: text }),
  );
  return print({ id: posted.id, url: posted.html_url });
}

/** comments <repo> <number>: one line per comment of the pull request's conversation, oldest first. */
export async function comments(repo: string | undefined, number: string | undefined): Promise<Outcome> {
  const api = connect(repo);
  const issue = numberOf(number);
  const list = await about(repo as string, issue, () =>
    api.request<CommentJson[]>("GET", `/issues/${issue}/comments?per_page=100`),
  );
  const me = await api.user().catch((error: unknown) => {
    if (error instanceof GitHubError && error.status === 403) return ACTIONS_USER;
    throw error;
  });
  return { lines: list.map((entry) => JSON.stringify(commentLine(entry, me))) };
}

/** protect <repo> <branch> [--check <name>]... [--approvals <n>]: replaces the branch protection of the branch. */
export async function protect(
  repo: string | undefined,
  branch: string | undefined,
  checks: string[],
  approvals = "0",
): Promise<Outcome> {
  const api = connect(repo);
  ensure(branch, "name the branch, like protect tester/web main --check verify");
  const required = count(approvals, 0, "--approvals takes a number, like --approvals 1");
  await api.request(
    "PUT",
    `/branches/${encodeURIComponent(branch as string)}/protection`,
    protection(checks, required),
  );
  return print({ branch, checks, approvals: required });
}

/** merge <repo> <number> [--method merge|squash|rebase]: merges, or names GitHub's reason when it refuses. */
export async function merge(repo: string | undefined, number: string | undefined, method = "merge"): Promise<Outcome> {
  const api = connect(repo);
  const issue = numberOf(number);
  ensure((MERGE_METHODS as readonly string[]).includes(method), `--method is one of ${MERGE_METHODS.join(", ")}`);
  try {
    const merged = await api.request<{ sha: string }>("PUT", `/pulls/${issue}/merge`, { merge_method: method });
    return print({ sha: merged.sha });
  } catch (error) {
    if (!(error instanceof GitHubError) || error.status !== 405) throw error;
    const reason = error.message === CONFLICT ? "it conflicts with its base" : error.message;
    throw new Error(`the forge refused to merge #${issue}: ${reason}`);
  }
}
