// pr <repo> <number>: the merge state of a pull request with the checks of its head commit.
import type { Outcome } from "@opensoftware/cli";
import { forge, line, type Pull, pullNumber, settle } from "./forge.ts";

interface Status {
  context: string;
  status: string;
  description: string;
  target_url: string;
}

export async function pr(repo: string | undefined, number: string | undefined): Promise<Outcome> {
  const api = forge(repo);
  const path = `/pulls/${pullNumber(number)}`;
  // An open pull request is not mergeable while Forgejo still checks it, so pr waits a moment for a true answer.
  const pull = await settle(
    () => api.call<Pull>("GET", path),
    (answer) => answer.mergeable || answer.state !== "open",
  );
  const combined = await api.call<{ statuses: Status[] | null }>("GET", `/commits/${pull.head.sha}/status`);
  const files = await api.call<{ filename: string }[]>("GET", `${path}/files?limit=100`);
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
    checks: (combined.statuses ?? []).map((status) => ({
      name: status.context,
      state: status.status,
      description: status.description,
      url: status.target_url,
    })),
    author: `forgejo:${pull.user.login}`,
    draft: pull.draft === true,
    labels: (pull.labels ?? []).map((label) => label.name),
    paths: files.map((file) => file.filename),
  });
}
