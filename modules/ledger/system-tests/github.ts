// The answers of GitHub's REST API for "ledger import": the pull requests of acme/web, newest update first, and the
// reviews and comments of each, as fakes.http routes. Only the fields ledger reads, with GitHub's names.
import type { HttpRoute } from "@opensoftware/testkit";

export interface GitHubUser {
  login: string;
  /** "User" or "Bot". */
  type?: string;
}

export interface GitHubPull {
  number: number;
  title?: string;
  user?: GitHubUser;
  created?: string;
  updated?: string;
  closed?: string;
  merged?: string;
  reviews?: { id: number; user: GitHubUser; state: string; at: string }[];
  comments?: { id: number; user: GitHubUser; at: string }[];
}

const REPO = "acme/web";
const PAGE = 100;
export const person = (login: string): GitHubUser => ({ login, type: "User" });

const pull = (pr: GitHubPull) => {
  const created = pr.created ?? "2026-01-05T09:00:00Z";
  return {
    number: pr.number,
    html_url: `https://github.com/${REPO}/pull/${pr.number}`,
    state: pr.closed ? "closed" : "open",
    title: pr.title ?? `Change ${pr.number}`,
    user: pr.user ?? person("mona"),
    created_at: created,
    updated_at: pr.updated ?? pr.closed ?? created,
    closed_at: pr.closed ?? null,
    merged_at: pr.merged ?? null,
    merge_commit_sha: pr.merged ? "4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d" : null,
    head: { ref: `change-${pr.number}`, sha: "9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c" },
    base: { ref: "main", repo: { html_url: `https://github.com/${REPO}` } },
  };
};

/** The list pages and, for each pull request, its reviews and its comments. */
export function githubRoutes(pulls: GitHubPull[]): HttpRoute[] {
  const pages: GitHubPull[][] = [];
  for (let index = 0; index <= pulls.length; index += PAGE) pages.push(pulls.slice(index, index + PAGE));
  return [
    ...pages.map((page, index) => ({
      path: `/repos/${REPO}/pulls?state=all&sort=updated&direction=desc&per_page=${PAGE}&page=${index + 1}`,
      body: page.map(pull),
    })),
    ...pulls.flatMap((pr) => [
      {
        path: `/repos/${REPO}/pulls/${pr.number}/reviews?per_page=${PAGE}&page=1`,
        body: (pr.reviews ?? []).map((review) => ({
          id: review.id,
          user: review.user,
          state: review.state,
          submitted_at: review.at,
        })),
      },
      {
        path: `/repos/${REPO}/issues/${pr.number}/comments?per_page=${PAGE}&page=1`,
        body: (pr.comments ?? []).map((comment) => ({ id: comment.id, user: comment.user, created_at: comment.at })),
      },
    ]),
  ];
}

/** The events of $OUTPUT/pr-events.jsonl, one object per line. */
// biome-ignore lint/suspicious/noExplicitAny: CloudEvents read back from the module's output
export async function readEvents(sut: { files: { read(path: string): Promise<string> } }): Promise<any[]> {
  return (await sut.files.read("$OUTPUT/pr-events.jsonl"))
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}
