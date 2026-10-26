// A Forgejo webhook delivery as a CloudEvent from contracts/ (ADR 0057, ADR 0065): pr.opened@v1, pr.reviewed@v1,
// pr.closed@v1 or issue.labeled@v1, or none for any other delivery.
import { createHmac, timingSafeEqual } from "node:crypto";

/** A delivery as the receiver wrote it: its headers and its body as it arrived. */
export interface Delivery {
  headers: Record<string, string>;
  body: string;
}

interface User {
  login: string;
  full_name?: string;
}

interface Payload {
  action?: string;
  sender: User;
  repository: { html_url: string };
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    user: User;
    merged: boolean;
    merge_commit_sha: string | null;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    head: { ref: string; sha: string };
    base: { ref: string };
  };
}

interface IssuePayload {
  action?: string;
  repository: { html_url: string };
  issue: {
    number: number;
    title: string;
    body: string;
    html_url: string;
    user: User;
    updated_at: string;
    labels: { name: string }[] | null;
  };
}

/** The review state of each Forgejo review event type. */
const REVIEWS: Record<string, string> = {
  pull_request_review_approved: "approved",
  pull_request_review_rejected: "changes_requested",
  pull_request_review_comment: "commented",
};

/** The value of a header, whatever the case of its name. */
export function header(delivery: Delivery, name: string): string | undefined {
  const entry = Object.entries(delivery.headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1];
}

/** Whether the delivery's X-Forgejo-Signature is the HMAC-SHA256 of its body with the secret. */
export function signedWith(delivery: Delivery, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(delivery.body).digest();
  const given = Buffer.from(header(delivery, "x-forgejo-signature") ?? "", "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The CloudEvent of the delivery, or undefined when it is not about a pull request or a labeled issue. */
export function pullRequestEvent(delivery: Delivery): Record<string, unknown> | undefined {
  const type = header(delivery, "x-forgejo-event-type") ?? "";
  if (type === "issue_label") return labeledIssue(delivery);
  const payload = JSON.parse(delivery.body) as Payload;
  const pr = payload.pull_request;
  const event = (name: string, time: string, data: Record<string, unknown>) =>
    envelope(delivery, name, time, pr.html_url, data);
  if (type === "pull_request" && payload.action === "opened") {
    return event("pr.opened", pr.created_at, {
      repository: payload.repository.html_url,
      number: pr.number,
      title: pr.title,
      headBranch: pr.head.ref,
      baseBranch: pr.base.ref,
      headCommit: pr.head.sha,
      author: person(pr.user),
    });
  }
  if (type === "pull_request" && payload.action === "closed") {
    const merge = pr.merged ? { mergeCommit: pr.merge_commit_sha } : {};
    return event("pr.closed", pr.closed_at ?? pr.updated_at, { merged: pr.merged, ...merge });
  }
  const state = REVIEWS[type];
  if (state) return event("pr.reviewed", pr.updated_at, { reviewer: person(payload.sender), state });
  return undefined;
}

/**
 * The issue.labeled@v1 event of an `issue_label` delivery. Forgejo sends `label_updated` with the labels after the
 * change and does not name the label added, so the event has no `label`.
 */
function labeledIssue(delivery: Delivery): Record<string, unknown> | undefined {
  const payload = JSON.parse(delivery.body) as IssuePayload;
  if (payload.action !== "label_updated") return undefined;
  const { issue } = payload;
  const body = issue.body ? { body: issue.body } : {};
  const labels = (issue.labels ?? []).map((label) => label.name);
  return envelope(delivery, "issue.labeled", issue.updated_at, issue.html_url, {
    repository: payload.repository.html_url,
    number: issue.number,
    title: issue.title,
    ...body,
    author: person(issue.user),
    labels,
  });
}

/** The `<name>@v1` CloudEvent about the pull request or issue at `url`, with Forgejo's delivery ID as its ID. */
function envelope(delivery: Delivery, name: string, time: string, url: string, data: Record<string, unknown>) {
  return {
    specversion: "1.0",
    id: header(delivery, "x-forgejo-delivery"),
    source: "/osf/forge",
    type: `${name}@v1`,
    time,
    subject: url,
    datacontenttype: "application/json",
    data: { url, ...data },
  };
}

function person(user: User): { kind: "person"; id: string; displayName: string } {
  return { kind: "person", id: `forgejo:${user.login}`, displayName: user.full_name || user.login };
}
