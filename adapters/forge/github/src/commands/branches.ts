// branch and open-pr: a branch at a commit, and a pull request from it.
import { check, type Outcome } from "@opensoftware/cli";
import { GitHubError } from "../adapters/github.ts";
import { connect, print } from "./shared.ts";

/** The fields of GitHub's pull request JSON that the commands read. */
export interface PullJson {
  number: number;
  html_url: string;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  mergeable: boolean | null;
  merge_commit_sha: string | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: { login: string };
  draft?: boolean;
  labels?: { name: string }[];
}

/** branch <repo> <branch> [--from <ref>]: the ref refs/heads/<branch> at the commit of the ref or the default branch. */
export async function branch(repo: string | undefined, name: string | undefined, from?: string): Promise<Outcome> {
  const api = connect(repo);
  check(name, "name the branch, like branch tester/web fix-checkout");
  const start = from ?? (await api.request<{ default_branch: string }>("GET", "")).default_branch;
  const { sha } = await api.request<{ sha: string }>("GET", `/commits/${encodeURIComponent(start)}`);
  await api.request("POST", "/git/refs", { ref: `refs/heads/${name}`, sha }).catch((error: unknown) => {
    const exists = error instanceof GitHubError && error.status === 422 && /already exists/.test(error.message);
    throw exists ? new Error(`branch ${name} exists`) : error;
  });
  return print({ branch: name, sha });
}

/** open-pr <repo> <head> --title <text> [--body <text>] [--base <branch>]. */
export async function openPr(
  repo: string | undefined,
  head: string | undefined,
  options: { title?: string; body?: string; base?: string },
): Promise<Outcome> {
  const api = connect(repo);
  check(head, "name the branch to merge, like open-pr tester/web fix-checkout --title ...");
  check(options.title, "give the pull request a --title");
  const base = options.base ?? (await api.request<{ default_branch: string }>("GET", "")).default_branch;
  const opened = await api.request<PullJson>("POST", "/pulls", {
    title: options.title,
    head,
    base,
    body: options.body ?? "",
  });
  return print({
    number: opened.number,
    url: opened.html_url,
    head: opened.head.ref,
    base: opened.base.ref,
    sha: opened.head.sha,
  });
}
