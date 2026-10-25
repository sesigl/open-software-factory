// A pull request as a gate: its URL, its forge and the request built from what the forge port's "pr" prints.
import { UsageError } from "@opensoftware/cli";
import type { GateRequest } from "./request.ts";

export interface PullRequest {
  url: string;
  /** "<owner>/<name>", as the forge port names a repository. */
  repository: string;
  number: number;
  /** The forge and its adapter: "github" on github.com, else "forgejo". Also the prefix of its identities. */
  forge: "github" | "forgejo";
  /** The forge's URL as its adapter takes it in FORGE_URL: GitHub's API, or the Forgejo's base URL. */
  api: string;
}

/** GitHub writes /<owner>/<repo>/pull/<n>, Forgejo /<owner>/<repo>/pulls/<n>. */
export function parsePullRequest(url: string, api: string | undefined): PullRequest {
  const match = URL.canParse(url) ? /^\/([^/]+)\/([^/]+)\/pulls?\/(\d+)\/?$/.exec(new URL(url).pathname) : null;
  if (!match) throw new UsageError(`${url} is not a pull request URL like https://github.com/acme/web/pull/12`);
  const { host, origin } = new URL(url);
  const github = host === "github.com";
  // gatekeeper 0.2 took Forgejo's API URL, which ends in /api/v1; the adapter adds that itself.
  const given = api?.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  return {
    url,
    repository: `${match[1]}/${match[2]}`,
    number: Number(match[3]),
    forge: github ? "github" : "forgejo",
    api: given || (github ? "https://api.github.com" : origin),
  };
}

/** What the forge port's "pr" prints that the request uses. */
export interface PullJson {
  url: string;
  title: string;
  author: string;
  head: string;
  sha: string;
  base: string;
  labels: string[];
  draft: boolean;
  paths: string[];
}

export function requestOf(pr: PullRequest, pull: PullJson): GateRequest {
  return {
    workItem: pull.url,
    stage: "merge",
    summary: `Merge ${pull.title}`,
    links: [{ url: pull.url, title: "Pull request" }],
    change: {
      repository: pr.repository,
      number: pr.number,
      author: pull.author,
      head: pull.head,
      sha: pull.sha,
      base: pull.base,
      labels: pull.labels,
      draft: pull.draft,
      paths: pull.paths,
    },
  };
}
