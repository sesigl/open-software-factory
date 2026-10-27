// What a delivery from the forge, Sentry or a Slack mention asks of the inbox, without I/O (ADR 0065).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { IssueLabeled, WorkItem, WorkItemView } from "@opensoftware/contracts";

type Submission = Omit<WorkItem, "id"> & { id?: string };

/** The first link to an issue in the text, like https://github.com/acme/web/issues/42, as Slack or a person wrote it. */
export function issueLink(text: string): string | undefined {
  return /https?:\/\/[^\s<>|]+?\/[^\s<>|/]+\/[^\s<>|/]+\/issues\/\d+(?![\w/])/.exec(text)?.[0];
}

/** A mention that links an issue takes the issue's link as its key, so it meets the label on that issue. */
export function joiningIssue(submission: Submission): Submission {
  const link = issueLink(`${submission.title}\n${submission.description ?? ""}`);
  return link ? { ...submission, dedupeKey: link } : submission;
}

/**
 * The reply in the thread of a mention: a new work item is received; a mention that joins a work item from another
 * surface is added, once per thread; anything else gets none.
 */
export function replyTo(thread: string, outcome: { created: boolean; added: boolean; view: WorkItemView }) {
  const { id } = outcome.view.workItem;
  if (outcome.created) return `Received as work item ${id}.`;
  const fromThread = outcome.view.requests.filter((request) => request.origin.externalId === thread);
  return outcome.added && fromThread.length === 1 ? `Added to work item ${id}.` : undefined;
}

/** The replies that link a finished run's pull requests, one in the thread of each Slack request of its work item. */
export function pullRequestReplies(view: WorkItemView, pullRequests: string[]): { thread: string; text: string }[] {
  if (!pullRequests.length) return [];
  const threads = view.requests.flatMap(({ origin }) =>
    origin.source === "slack" && origin.externalId ? [origin.externalId] : [],
  );
  const text = pullRequests.map((url) => `Pull request: ${url}`).join("\n");
  return [...new Set(threads)].map((thread) => ({ thread, text }));
}

/** The task of an issue that carries the label, with the issue's link as its key; undefined for any other issue. */
export function issueWork(event: IssueLabeled, label: string): Submission | undefined {
  const { data } = event;
  if (!data.labels.includes(label)) return undefined;
  const repository = new URL(data.repository).pathname.slice(1);
  return {
    type: "task",
    title: data.title.slice(0, 300),
    ...(data.body ? { description: data.body } : {}),
    requester: data.author,
    origin: {
      source: data.author.id.split(":")[0] as string,
      url: data.url,
      externalId: `${repository}#${data.number}`,
    },
    dedupeKey: data.url,
  };
}

/** Whether Sentry-Hook-Signature is the hex HMAC-SHA256 of the body with the integration's client secret. */
export function signedBySentry(signature: string | undefined, body: string, secret: string): boolean {
  const given = Buffer.from(signature ?? "", "hex");
  const wanted = createHmac("sha256", secret).update(body).digest();
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** The fields of Sentry's event_alert payload that intake reads. */
interface EventAlert {
  data?: {
    triggered_rule?: string;
    event?: { title?: string; level?: string; web_url?: string; issue_id?: string | number; release?: string | null };
  };
}

/** A rule's name as the ID of a trigger: lowercase, with hyphens for spaces, like "fatal-errors". */
const slug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

/**
 * The bug of an event_alert about a fatal error: it links the error and, with a template, the release it happened
 * in. Any other resource or level gives undefined; an alert without a title or link is refused by the contract.
 */
export function sentryWork(resource: string | undefined, payload: EventAlert, changeUrl?: string) {
  const event = payload.data?.event;
  if (resource !== "event_alert" || event?.level !== "fatal") return undefined;
  const error = event.web_url as string;
  const links = [{ url: error, title: "The error in Sentry" }];
  if (changeUrl && event.release)
    links.push({ url: changeUrl.replaceAll("{release}", event.release), title: "The change" });
  const submission: Submission = {
    type: "bug",
    title: (event.title ?? "").slice(0, 300),
    requester: { kind: "trigger", id: `sentry:${slug(payload.data?.triggered_rule ?? "alert")}` },
    origin: { source: "sentry", url: error, externalId: String(event.issue_id) },
    dedupeKey: `sentry:${event.issue_id}`,
    links,
  };
  return submission;
}
