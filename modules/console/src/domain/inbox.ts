// The self-improvement inbox's rules, without I/O (ADR 0073): the state a person reads for a review state of `prs`.

const STATES: Record<string, string> = { approved: "approved", changes_requested: "changes requested" };

/** "approved", "changes requested", or "needs review" for any other review state. */
export const proposalState = (review: string): string => STATES[review] ?? "needs review";
