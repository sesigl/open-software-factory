// What a delivery from the forge, Sentry or a Slack mention asks of the inbox, without I/O (ADR 0065).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { GateRequested, IssueLabeled, WorkItem, WorkItemView } from "@opensoftware/contracts";
import type { RunFact } from "./view.ts";

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

/** Where a request hears of its work item's run: the thread of a Slack request, or the issue "<owner>/<name>#<n>". */
export interface Reply {
  to: "slack" | "issue";
  at: string;
  text: string;
}

/** An issue's request has the external ID "<owner>/<name>#<number>" (issueWork). */
const ISSUE = /^[^/\s]+\/[^/\s#]+#\d+$/;

/** The replies of the texts: each text once in the thread of each Slack request and on each issue of the work item. */
export function replies(view: WorkItemView, texts: string[]): Reply[] {
  // A Slack request's external ID is its thread.
  const places = view.requests.flatMap(({ origin }): Omit<Reply, "text">[] => {
    const at = origin.externalId as string;
    if (origin.source === "slack") return [{ to: "slack", at }];
    return ISSUE.test(at) ? [{ to: "issue", at }] : [];
  });
  const unique = [...new Map(places.map((place) => [`${place.to} ${place.at}`, place])).values()];
  return unique.flatMap((place) => texts.map((text) => ({ ...place, text })));
}

/** The run's page in the console after a space, like " https://console.example/runs/run_1"; empty without either. */
const runLink = (console: string | undefined, runId: string | undefined) =>
  console && runId ? ` ${console}/runs/${runId}` : "";

/**
 * What the requesters hear of a run event (ADR 0113): a link per pull request of a run that succeeded, and the
 * outcome and stage of a run that failed or was cancelled, with the run's link; nothing of a run that started.
 */
export function runTexts(fact: RunFact, console: string | undefined): string[] {
  if (fact.status === "complete") return fact.pullRequests.map((url) => `Pull request: ${url}`);
  if (fact.status === "running") return [];
  const stage = fact.stage ? ` at the stage ${fact.stage}` : "";
  return [`The run ended with the outcome ${fact.status}${stage}:${runLink(console, fact.runId) || ` ${fact.runId}`}`];
}

/** What the requesters hear of a gate.requested@v1: the stage that waits, what is asked, and the run's link. */
export function gateText(gate: GateRequested["data"], runId: string | undefined, console: string | undefined): string {
  return `The run waits for a decision at the stage ${gate.stage}: ${gate.summary}${runLink(console, runId)}`;
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
