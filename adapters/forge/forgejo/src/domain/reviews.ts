// A pull request's review state as prs prints it (ADR 0073).

/** The states prs takes in --state; Forgejo's list takes the same three. */
export const LIST_STATES = ["open", "closed", "all"];

/** A review as Forgejo lists it. */
export interface Review {
  user: { login: string } | null;
  state: string;
  dismissed?: boolean;
}

/**
 * "changes_requested" when some reviewer's latest verdict asks for changes, else "approved" when one approves, else
 * "none". Reviews come oldest first; comments, pending and dismissed reviews do not count, and Forgejo refuses an
 * author's verdict on their own pull request.
 */
export function reviewOf(reviews: Review[]): "changes_requested" | "approved" | "none" {
  const verdicts = new Map<string, string>();
  for (const review of reviews)
    if (!review.dismissed && (review.state === "APPROVED" || review.state === "REQUEST_CHANGES"))
      verdicts.set(review.user?.login ?? "", review.state);
  const all = new Set(verdicts.values());
  if (all.has("REQUEST_CHANGES")) return "changes_requested";
  return all.has("APPROVED") ? "approved" : "none";
}
