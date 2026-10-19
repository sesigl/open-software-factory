// Automation event filters such as "forgejo.issue.labeled(auto-implement)": their parts and the events each forge
// sends for them (ADR 0022).
import { fail } from "./errors.ts";

export interface Filter {
  /** The system that sends the event, for example "forgejo" or "github". */
  source: string;
  subject: string;
  action?: string;
  /** The argument in parentheses, for example the label "auto-implement". */
  argument?: string;
}

export function parseFilter(filter: string): Filter {
  const match = /^([a-z][a-z0-9-]*)\.([a-z][a-z0-9_-]*)(?:\.([a-z][a-z0-9_-]*))?(?:\(([^)]*)\))?$/.exec(filter);
  const [, source = "", subject = "", action, argument] = match ?? fail(`the event filter "${filter}" does not parse`);
  return { source, subject, action, argument };
}

/** Forgejo webhook events by "<subject>.<action>", then by "<subject>". */
const FORGEJO: Record<string, string> = {
  push: "push",
  "issue.labeled": "issue_label",
  "issue.unlabeled": "issue_label",
  "issue.commented": "issue_comment",
  issue: "issues",
  "pull_request.labeled": "pull_request_label",
  pull_request: "pull_request",
  release: "release",
};

export function forgejoEvent(filter: string): string {
  const { subject, action } = parseFilter(filter);
  return (
    FORGEJO[`${subject}.${action}`] ?? FORGEJO[subject] ?? fail(`there is no Forgejo webhook event for "${filter}"`)
  );
}

/** GitHub Actions events by subject, as gh-aw reads them under "on". */
const GITHUB: Record<string, string> = {
  issue: "issues",
  pull_request: "pull_request",
  issue_comment: "issue_comment",
  push: "push",
  release: "release",
};

/** The "on" section of a GitHub workflow for one event filter. */
export function githubTrigger(filter: string): Record<string, unknown> {
  const { subject, action, argument } = parseFilter(filter);
  const event = GITHUB[subject] ?? fail(`there is no GitHub event for "${filter}"`);
  const types = action ? { types: [action] } : {};
  return { [event]: { ...types, ...(argument ? { names: [argument] } : {}) } };
}
