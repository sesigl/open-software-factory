// A pull request as a gate: its URL, its forge API and the request built from it.
import { UsageError } from "@opensoftware/cli";
import type { GateRequest } from "./request.ts";

export interface PullRequest {
  url: string;
  owner: string;
  repo: string;
  number: number;
  /** Base URL of the forge API, without a trailing slash. */
  api: string;
  /** Prefix of the identities on this forge: "github" on github.com, else "forgejo". */
  forge: string;
}

/** GitHub writes /<owner>/<repo>/pull/<n>, Forgejo /<owner>/<repo>/pulls/<n>. */
export function parsePullRequest(url: string, api: string | undefined): PullRequest {
  const match = URL.canParse(url) ? /^\/([^/]+)\/([^/]+)\/pulls?\/(\d+)\/?$/.exec(new URL(url).pathname) : null;
  if (!match) throw new UsageError(`${url} is not a pull request URL like https://github.com/acme/web/pull/12`);
  const { host, origin } = new URL(url);
  const github = host === "github.com";
  return {
    url,
    owner: match[1] as string,
    repo: match[2] as string,
    number: Number(match[3]),
    api: (api || (github ? "https://api.github.com" : `${origin}/api/v1`)).replace(/\/+$/, ""),
    forge: github ? "github" : "forgejo",
  };
}

/** The fields of the forge's pull request JSON that the request uses. */
export interface PullJson {
  html_url: string;
  title: string;
  draft?: boolean;
  user: { login: string };
  head: { ref: string; sha: string };
  base: { ref: string };
  labels?: { name: string }[];
}

export function requestOf(pr: PullRequest, pull: PullJson, paths: string[]): GateRequest {
  return {
    workItem: pull.html_url,
    stage: "merge",
    summary: `Merge ${pull.title}`,
    links: [{ url: pull.html_url, title: "Pull request" }],
    change: {
      repository: `${pr.owner}/${pr.repo}`,
      number: pr.number,
      author: `${pr.forge}:${pull.user.login}`,
      head: pull.head.ref,
      sha: pull.head.sha,
      base: pull.base.ref,
      labels: (pull.labels ?? []).map((label) => label.name),
      draft: pull.draft ?? false,
      paths,
    },
  };
}
