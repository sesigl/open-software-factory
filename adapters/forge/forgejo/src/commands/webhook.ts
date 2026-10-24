// webhook <repo> <url>: one Forgejo webhook per URL for pull request events, signed with FORGE_WEBHOOK_SECRET.
import { check, type Outcome } from "@opensoftware/cli";
import { forge, line } from "./forge.ts";

/** The events `event` turns into CloudEvents: pull requests opened and closed, and the three kinds of review. */
const EVENTS = [
  "pull_request",
  "pull_request_review_approved",
  "pull_request_review_rejected",
  "pull_request_review_comment",
];

export async function webhook(repo: string | undefined, url: string | undefined): Promise<Outcome> {
  const api = forge(repo);
  check(url, "name the URL that receives the deliveries, like webhook tester/web https://intake.example/forge");
  const secret = process.env.FORGE_WEBHOOK_SECRET;
  check(secret, "set FORGE_WEBHOOK_SECRET to the secret the deliveries are signed with");
  const hook = { config: { url, content_type: "json", secret }, events: EVENTS, active: true };
  const hooks = await api.call<{ id: number; config: { url: string } }[]>("GET", "/hooks");
  const existing = hooks.find((candidate) => candidate.config.url === url);
  const saved = existing
    ? await api.call<{ id: number }>("PATCH", `/hooks/${existing.id}`, hook)
    : await api.call<{ id: number }>("POST", "/hooks", { type: "forgejo", ...hook });
  return line({ id: saved.id, url });
}
