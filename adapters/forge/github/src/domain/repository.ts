// The arguments the port names on the command line, checked before any call to GitHub.

/** Matches "<owner>/<name>". */
export const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;

/** The states a check may have; GitHub's commit statuses have the same four. */
export const CHECK_STATES = ["pending", "success", "failure", "error"] as const;

/** GitHub's merge methods. */
export const MERGE_METHODS = ["merge", "squash", "rebase"] as const;

/** The webhook events: pull requests, their reviews, and the comments on them, which `event` leaves out. */
export const HOOK_EVENTS = ["issue_comment", "pull_request", "pull_request_review"];

/** The branch protection for these checks and approvals; it applies to admins too. */
export function protection(checks: string[], approvals: number) {
  return {
    required_status_checks: { strict: false, contexts: checks },
    enforce_admins: true,
    required_pull_request_reviews: { required_approving_review_count: approvals },
    restrictions: null,
  };
}
