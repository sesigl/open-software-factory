// A GitHub webhook delivery as a pull request CloudEvent from contracts/ (ADR 0058): pr.opened@v1, pr.reviewed@v1 or
// pr.closed@v1, or none for any other delivery.
import { createHmac, timingSafeEqual } from "node:crypto";

/** A delivery as the receiver wrote it: its headers and its body as it arrived. */
export interface Delivery {
  headers: Record<string, string>;
  body: string;
}

interface Account {
  login: string;
}

interface PullRequestPayload {
  action?: string;
  repository: { html_url: string };
  pull_request: {
    html_url: string;
    number: number;
    title: string;
    user: Account;
    created_at: string;
    closed_at: string | null;
    merged: boolean;
    merge_commit_sha: string | null;
    head: { ref: string; sha: string };
    base: { ref: string };
  };
  /** Only in a pull_request_review delivery. */
  review: { state: string; user: Account; submitted_at: string };
}

/** The value of a header, whatever the case of its name. */
export function header(delivery: Delivery, name: string): string | undefined {
  return Object.entries(delivery.headers).find(([key]) => key.toLowerCase() === name)?.[1];
}

/** Whether X-Hub-Signature-256 is "sha256=" and the HMAC-SHA256 of the body with the secret. */
export function verified(delivery: Delivery, secret: string): boolean {
  const signature = header(delivery, "x-hub-signature-256") ?? "";
  if (!signature.startsWith("sha256=")) return false;
  const given = Buffer.from(signature.slice("sha256=".length), "hex");
  const wanted = createHmac("sha256", secret).update(delivery.body).digest();
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** The CloudEvent of a delivery about an opened, reviewed or closed pull request, or undefined. */
export function toCloudEvent(delivery: Delivery): Record<string, unknown> | undefined {
  const kind = header(delivery, "x-github-event");
  if (kind !== "pull_request" && kind !== "pull_request_review") return undefined;
  const payload = JSON.parse(delivery.body) as PullRequestPayload;
  const pull = payload.pull_request;
  const envelope = (type: string, time: string | null, data: Record<string, unknown>) => ({
    specversion: "1.0",
    id: header(delivery, "x-github-delivery"),
    source: "/osf/forge",
    type,
    time,
    subject: pull.html_url,
    datacontenttype: "application/json",
    data: { url: pull.html_url, ...data },
  });
  if (kind === "pull_request_review") {
    const review = payload.review;
    if (payload.action !== "submitted") return undefined;
    return envelope("pr.reviewed@v1", review.submitted_at, { reviewer: person(review.user), state: review.state });
  }
  if (payload.action === "opened")
    return envelope("pr.opened@v1", pull.created_at, {
      repository: payload.repository.html_url,
      number: pull.number,
      title: pull.title,
      headBranch: pull.head.ref,
      baseBranch: pull.base.ref,
      headCommit: pull.head.sha,
      author: person(pull.user),
    });
  const merge = pull.merged ? { mergeCommit: pull.merge_commit_sha } : {};
  // Any other action, such as synchronize or reopened, gives no event.
  return payload.action === "closed"
    ? envelope("pr.closed@v1", pull.closed_at, { merged: pull.merged, ...merge })
    : undefined;
}

/** A GitHub account as a person of the contracts: GitHub's payloads carry the login, not the name. */
function person(account: Account) {
  return { kind: "person", id: `github:${account.login}`, displayName: account.login };
}
