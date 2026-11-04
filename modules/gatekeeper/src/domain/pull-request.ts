// A pull request as a gate: its URL, the forge adapter that reaches it, and the request built from it (ADR 0062).
import { UsageError } from "@opensoftware/cli";
import type { Outcome } from "./gate.ts";
import type { GateRequest, Link } from "./request.ts";

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
  const pr = pullRequestOf(url);
  if (!pr) throw new UsageError(`${url} is not a pull request URL like https://github.com/acme/web/pull/12`);
  return pr;
}

/** The pull request of the URL, or undefined when the URL is no pull request. */
export function pullRequestOf(url: string): PullRequest | undefined {
  const match = URL.canParse(url) ? /^\/([^/]+)\/([^/]+)\/pulls?\/(\d+)\/?$/.exec(new URL(url).pathname) : null;
  if (!match) return undefined;
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

/** The first link of a request that is a pull request: the server asks there (ADR 0080). */
export function pullRequestIn(links: Link[]): PullRequest | undefined {
  for (const link of links) {
    const pr = pullRequestOf(link.url);
    if (pr) return pr;
  }
  return undefined;
}

const STATES = { pending: "pending", approved: "success", rejected: "failure", expired: "failure" } as const;

/** The state of the commit status "gatekeeper" for the gate's outcome. */
export const commitState = (outcome: Outcome) => STATES[outcome.state];

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
