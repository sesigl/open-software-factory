// A forge's pull requests, reviews and comments, as GitHub's REST API and Forgejo's API v1 return them, turned into
// the CloudEvents pr.opened@v1, pr.reviewed@v1 and pr.closed@v1 (ADR 0036).
import { check } from "./errors.ts";

export type ForgeKind = "github" | "forgejo";

export interface ForgeUser {
  login: string;
  type?: string;
}

export interface ForgePull {
  number: number;
  html_url: string;
  title: string;
  user: ForgeUser;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  head: { ref: string; sha: string };
  base: { ref: string; repo?: { html_url?: string } | null };
}

export interface ForgeReview {
  id: number;
  user: ForgeUser | null;
  state: string;
  submitted_at?: string | null;
}

export interface ForgeComment {
  id: number;
  user: ForgeUser | null;
  created_at: string;
}

export interface Repository {
  kind: ForgeKind;
  /** The repository's web URL without a trailing slash, like https://github.com/acme/web. */
  url: string;
  owner: string;
  name: string;
  /** The base URL of the forge's API. */
  api: string;
}

/** The repository a URL names, and the API of its forge: `--forge` and `LEDGER_FORGE_URL` override the defaults. */
export function repositoryOf(text: string, forge: string | undefined, apiUrl: string | undefined): Repository {
  const url = URL.canParse(text) ? new URL(text) : undefined;
  const [owner, name] = (url?.pathname ?? "").split("/").filter(Boolean);
  check(url && owner && name, `${text}: not a repository URL like https://github.com/acme/web`);
  check(forge === undefined || forge === "github" || forge === "forgejo", "--forge takes github or forgejo");
  const kind: ForgeKind = forge ?? (url.host === "github.com" ? "github" : "forgejo");
  const api =
    kind === "forgejo"
      ? `${url.origin}/api/v1`
      : url.host === "github.com"
        ? "https://api.github.com"
        : `${url.origin}/api/v3`;
  return { kind, url: `${url.origin}/${owner}/${name}`, owner, name, api: (apiUrl || api).replace(/\/$/, "") };
}

const STATES: Record<string, "approved" | "changes_requested" | "commented"> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  REQUEST_CHANGES: "changes_requested",
  COMMENTED: "commented",
  COMMENT: "commented",
  DISMISSED: "commented",
};

const isBot = (user: ForgeUser) => user.type === "Bot" || user.login.endsWith("[bot]");

/** The events of one pull request: opened, its reviews and comments by others than its author, and closed. */
export function pullEvents(
  repository: Repository,
  pull: ForgePull,
  reviews: ForgeReview[],
  comments: ForgeComment[],
): Record<string, unknown>[] {
  const actor = (user: ForgeUser) => ({
    kind: isBot(user) ? "trigger" : "person",
    id: `${repository.kind}:${user.login}`,
  });
  const event = (id: string, type: string, time: string, data: Record<string, unknown>) => ({
    specversion: "1.0",
    id: `pr-${pull.number}-${id}`,
    source: repository.url,
    type,
    time: new Date(time).toISOString().replace(".000Z", "Z"),
    subject: pull.html_url,
    datacontenttype: "application/json",
    data,
  });
  const byOthers = (user: ForgeUser | null): user is ForgeUser => user !== null && user.login !== pull.user.login;
  const reviewed = (id: string, time: string, user: ForgeUser, state: string) =>
    event(id, "pr.reviewed@v1", time, { url: pull.html_url, reviewer: actor(user), automated: isBot(user), state });

  const events = [
    event("opened", "pr.opened@v1", pull.created_at, {
      url: pull.html_url,
      repository: pull.base.repo?.html_url || repository.url,
      number: pull.number,
      title: pull.title,
      headBranch: pull.head.ref,
      baseBranch: pull.base.ref,
      headCommit: pull.head.sha,
      author: actor(pull.user),
    }),
    ...reviews.flatMap((review) => {
      const state = STATES[review.state];
      if (!state || !review.submitted_at || !byOthers(review.user)) return [];
      return [reviewed(`review-${review.id}`, review.submitted_at, review.user, state)];
    }),
    ...comments.flatMap((comment) =>
      byOthers(comment.user) ? [reviewed(`comment-${comment.id}`, comment.created_at, comment.user, "commented")] : [],
    ),
  ];
  const closedAt = pull.merged_at ?? pull.closed_at;
  if (closedAt) {
    const merged = pull.merged_at !== null;
    const commit = merged && /^[0-9a-f]{7,40}$/.test(pull.merge_commit_sha ?? "") ? pull.merge_commit_sha : undefined;
    events.push(
      event("closed", "pr.closed@v1", closedAt, {
        url: pull.html_url,
        merged,
        ...(commit ? { mergeCommit: commit } : {}),
      }),
    );
  }
  return events;
}
