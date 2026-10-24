// The port's webhook events as Forgejo's, and a Forgejo webhook as the port prints it (ADR 0060).

/** Forgejo's events by the port's "<object>[.<action>]"; any other name maps like its object, or is Forgejo's own. */
const EVENTS: Record<string, string[]> = {
  issue: ["issues"],
  "issue.labeled": ["issue_label"],
  "pull_request.labeled": ["pull_request_label"],
  pull_request_review: ["pull_request_review_approved", "pull_request_review_rejected", "pull_request_review_comment"],
};

/** The events `event` turns into CloudEvents, when the client names none. */
const DEFAULT = ["pull_request", "pull_request_review"];

/** Forgejo's events for the port's names, sorted and without repeats. */
export function forgeEvents(names: string[]): string[] {
  const events = (names.length > 0 ? names : DEFAULT).flatMap((name) => {
    const object = name.split(".")[0] as string;
    return EVENTS[name] ?? EVENTS[object] ?? [object];
  });
  return [...new Set(events)].sort();
}

/** What the port prints of a Forgejo webhook. */
export interface HookJson {
  active: boolean;
  config: { url: string };
  events: string[];
  id: number;
}

/** One line of `webhook` or `hooks`: the webhook's ID, URL, events sorted, and whether it is active. */
export const hookLine = ({ id, config, events, active }: HookJson): string =>
  JSON.stringify({ id, url: config.url, events: [...events].sort(), active });
