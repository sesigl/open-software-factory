// The arguments the port names on the command line, checked before any call to GitHub.

/** Matches "<owner>/<name>". */
export const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;

/** The states a check may have; GitHub's commit statuses have the same four. */
export const CHECK_STATES = ["pending", "success", "failure", "error"] as const;

/** GitHub's merge methods. */
export const MERGE_METHODS = ["merge", "squash", "rebase"] as const;

/** The webhook events without --event: pull requests, their reviews, and the comments on them, which `event` leaves out. */
const HOOK_EVENTS = ["issue_comment", "pull_request", "pull_request_review"];

/** GitHub's event by the port's object, when its name differs; an action does not change GitHub's event. */
const EVENTS: Record<string, string> = { issue: "issues" };

/** GitHub's events for the port's "<object>[.<action>]" names, sorted and without repeats (ADR 0060). */
export function githubEvents(names: string[]): string[] {
  if (names.length === 0) return HOOK_EVENTS;
  const events = names.map((name) => {
    const object = name.split(".")[0] as string;
    return EVENTS[object] ?? object;
  });
  return [...new Set(events)].sort();
}

/** The fields of GitHub's webhook JSON that the port prints. */
export interface HookJson {
  id: number;
  config: { url?: string };
  events: string[];
  active: boolean;
}

export function hookLine(hook: HookJson) {
  return { id: hook.id, url: hook.config.url, events: [...hook.events].sort(), active: hook.active };
}

/** The branch protection for these checks and approvals; it applies to admins too. */
export function protection(checks: string[], approvals: number) {
  return {
    required_status_checks: { strict: false, contexts: checks },
    enforce_admins: true,
    required_pull_request_reviews: { required_approving_review_count: approvals },
    restrictions: null,
  };
}

/** The fields of GitHub's comment JSON that the port prints. */
export interface CommentJson {
  id: number;
  html_url: string;
  body: string;
  created_at: string;
  user: { login: string };
}

/** A comment as `comments` prints it; `me` is the login of the token's user (ADR 0062). */
export function commentLine(comment: CommentJson, me: string) {
  return {
    id: comment.id,
    url: comment.html_url,
    author: `github:${comment.user.login}`,
    time: comment.created_at,
    text: comment.body,
    mine: comment.user.login === me,
  };
}
