// The webhook endpoints of intake serve (ADR 0063, ADR 0065): Slack through the channel adapter, the forge through the
// forge adapter, and Sentry. Each reads the raw body, because its sender signs the body as it was sent.
import type { IssueLabeled } from "@opensoftware/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Channel } from "../adapters/channel.ts";
import type { Forge } from "../adapters/forge.ts";
import type { Delivery } from "../adapters/program.ts";
import { issueWork, joiningIssue, replyTo, sentryWork, signedBySentry } from "../domain/sources.ts";
import type { Inbox } from "./inbox.ts";

/** An error answer in the shape of RFC 9457. */
export const problem = (reply: FastifyReply, status: number, title: string, detail: string) =>
  reply.code(status).type("application/problem+json").send({ title, status, detail });

type Handler = (delivery: Delivery, reply: FastifyReply) => Promise<unknown>;

/** A POST route that hands the handler the delivery: the headers and the body as text, as it arrived. */
async function webhook(app: FastifyInstance, path: string, handle: Handler): Promise<void> {
  await app.register(async (hooks) => {
    hooks.removeAllContentTypeParsers();
    hooks.addContentTypeParser("*", { parseAs: "string" }, (_request, body, done) => done(null, body));
    hooks.post(path, async (request: FastifyRequest, reply) => {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(request.headers)) if (typeof value === "string") headers[name] = value;
      return handle({ headers, body: String(request.body ?? "") }, reply);
    });
  });
}

/** Slack's events: a mention becomes a work item, or joins the work item of the issue it links. */
export const slackHook = (app: FastifyInstance, work: Inbox, channel: Channel) =>
  webhook(app, "/slack/events", async (delivery, reply) => {
    const lines = await channel.receive(delivery);
    if (!lines) return problem(reply, 401, "Unauthorized", "the Slack signature does not match");
    const payload = JSON.parse(delivery.body) as { type?: string; challenge?: string };
    if (payload.type === "url_verification") return { challenge: payload.challenge };
    for (const line of lines) {
      if (line.kind !== "work") continue;
      const submission = joiningIssue(line.workItem as Parameters<typeof joiningIssue>[0]);
      const outcome = await work.submit(submission);
      const thread = submission.origin.externalId;
      const text = thread && replyTo(thread, outcome);
      if (thread && text) await channel.reply(thread, text);
    }
    return reply.code(200).send();
  });

/** The forge's deliveries: an issue that gets the label becomes a work item. */
export const forgeHook = (app: FastifyInstance, work: Inbox, forge: Forge, label: string) =>
  webhook(app, "/forge/events", async (delivery, reply) => {
    const events = await forge.events(delivery);
    if (!events) return problem(reply, 401, "Unauthorized", "the forge's signature does not match");
    for (const event of events) {
      const submission = event.type === "issue.labeled@v1" && issueWork(event as unknown as IssueLabeled, label);
      if (submission) await work.submit(submission);
    }
    return reply.code(200).send();
  });

/** Sentry's deliveries: an alert about a fatal error becomes a bug. */
export const sentryHook = (app: FastifyInstance, work: Inbox, secret: string, changeUrl: string | undefined) =>
  webhook(app, "/sentry/events", async ({ headers, body }, reply) => {
    if (!signedBySentry(headers["sentry-hook-signature"], body, secret))
      return problem(reply, 401, "Unauthorized", "the Sentry-Hook-Signature does not match INTAKE_SENTRY_SECRET");
    const submission = sentryWork(headers["sentry-hook-resource"], JSON.parse(body), changeUrl);
    if (submission) await work.submit(submission);
    return reply.code(200).send();
  });
