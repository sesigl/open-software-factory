// pr <repo> <number>: the merge state of a pull request with the checks of its head commit.
import type { Outcome } from "@opensoftware/cli";
import { about, forge, line, type Pull, pullNumber, settle } from "./forge.ts";

interface Status {
  context: string;
  status: string;
  description: string;
  target_url: string;
}

/** The first 100 files a pull request changes, the most a policy reads (ADR 0061). */
const PATHS = 100;

export async function pr(repo: string | undefined, number: string | undefined): Promise<Outcome> {
  const api = forge(repo);
  const issue = pullNumber(number);
  const path = `/pulls/${issue}`;
  // An open pull request is not mergeable while Forgejo still checks it, so pr waits a moment for a true answer.
  const pull = await about(repo as string, issue, () =>
    settle(
      () => api.call<Pull>("GET", path),
      (answer) => answer.mergeable || answer.state !== "open",
    ),
  );
  const files = await api.call<{ filename: string }[]>("GET", `${path}/files?limit=${PATHS}`);
  const combined = await api.call<{ statuses: Status[] | null }>("GET", `/commits/${pull.head.sha}/status`);
  return line({
    number: pull.number,
    url: pull.html_url,
    title: pull.title,
    state: pull.merged ? "merged" : pull.state,
    mergeable: pull.mergeable,
    head: pull.head.ref,
    base: pull.base.ref,
    sha: pull.head.sha,
    mergeCommit: pull.merged ? pull.merge_commit_sha : null,
    author: `forgejo:${pull.user.login}`,
    labels: (pull.labels ?? []).map((label) => label.name),
    draft: pull.draft === true,
    paths: files.map((file) => file.filename),
    checks: (combined.statuses ?? []).map((status) => ({
      name: status.context,
      state: status.status,
      description: status.description,
      url: status.target_url,
    })),
  });
}
