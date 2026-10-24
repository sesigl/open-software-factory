// pr <repo> <number>: the merge state of a pull request with the checks of its head commit.
import type { Outcome } from "@opensoftware/cli";
import { forge, line, type Pull, pullNumber } from "./forge.ts";

interface Status {
  context: string;
  status: string;
  description: string;
  target_url: string;
}

export async function pr(repo: string | undefined, number: string | undefined): Promise<Outcome> {
  const api = forge(repo);
  const pull = await api.call<Pull>("GET", `/pulls/${pullNumber(number)}`);
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
    checks: (combined.statuses ?? []).map((status) => ({
      name: status.context,
      state: status.status,
      description: status.description,
      url: status.target_url,
    })),
  });
}
