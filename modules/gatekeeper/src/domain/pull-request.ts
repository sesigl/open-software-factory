// A pull request as a gate: its URL, the forge adapter that reaches it, and the request built from it (ADR 0061).
import { UsageError } from "@opensoftware/cli";
import type { GateRequest } from "./request.ts";

export interface PullRequest {
  url: string;
  owner: string;
  repo: string;
  number: number;
  /** True on github.com, where the forge adapter is forge-github; any other host is a Forgejo. */
  github: boolean;
  /** The forge's URL that the adapter gets as FORGE_URL, unless GATEKEEPER_FORGE_URL names another. */
  forgeUrl: string;
}

/** GitHub writes /<owner>/<repo>/pull/<n>, Forgejo /<owner>/<repo>/pulls/<n>. */
export function parsePullRequest(url: string): PullRequest {
  const match = URL.canParse(url) ? /^\/([^/]+)\/([^/]+)\/pulls?\/(\d+)\/?$/.exec(new URL(url).pathname) : null;
  if (!match) throw new UsageError(`${url} is not a pull request URL like https://github.com/acme/web/pull/12`);
  const { host, origin } = new URL(url);
  const github = host === "github.com";
  return {
    url,
    owner: match[1] as string,
    repo: match[2] as string,
    number: Number(match[3]),
    github,
    forgeUrl: github ? "https://api.github.com" : origin,
  };
}

/** The adapter's command line when GATEKEEPER_FORGE_ADAPTER names none. */
export const defaultForgeAdapter = (pr: PullRequest): string =>
  `npx -y @opensoftware/${pr.github ? "forge-github" : "forge-forgejo"}`;

/** The fields of the forge port's `pr` line that the request uses. */
export interface PullLine {
  url: string;
  title: string;
  head: string;
  base: string;
  sha: string;
  /** `<adapter>:<login>`, like "github:octocat". */
  author: string;
  labels: string[];
  draft: boolean;
  paths: string[];
}

/** The prefix of the identities on the pull request's forge, like "github": the adapter's name in `author`. */
export const forgeOf = (pull: PullLine): string => pull.author.slice(0, pull.author.indexOf(":"));

export function requestOf(pr: PullRequest, pull: PullLine): GateRequest {
  return {
    workItem: pull.url,
    stage: "merge",
    summary: `Merge ${pull.title}`,
    links: [{ url: pull.url, title: "Pull request" }],
    change: {
      repository: `${pr.owner}/${pr.repo}`,
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
