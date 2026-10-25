// intake serve: the work item API, Slack's events through the channel adapter, and the relay of the outbox every
// minute (ADR 0063). It runs until SIGTERM or SIGINT.
import { timingSafeEqual } from "node:crypto";
import { UsageError } from "@opensoftware/cli";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { type Channel, channelAdapter } from "../adapters/channel.ts";
import { openStore } from "../adapters/store.ts";
import { nowOf } from "../domain/time.ts";
import { type Env, required } from "./env.ts";
import { type Inbox, inbox } from "./inbox.ts";

const RELAY_EVERY_MS = 60_000;

/** Compares in constant time, so the answer's timing does not tell how much of a token was right. */
function bearerMatches(header: string | undefined, token: string): boolean {
  const sent = Buffer.from(header ?? "");
  const wanted = Buffer.from(`Bearer ${token}`);
  return sent.length === wanted.length && timingSafeEqual(sent, wanted);
}

/** An error answer in the shape of RFC 9457. */
const problem = (reply: FastifyReply, status: number, title: string, detail: string) =>
  reply.code(status).type("application/problem+json").send({ title, status, detail });

async function workItemRoutes(app: FastifyInstance, work: Inbox, apiToken: string): Promise<void> {
  await app.register(async (api) => {
    api.addHook("onRequest", async (request, reply) => {
      if (!bearerMatches(request.headers.authorization, apiToken))
        return problem(reply, 401, "Unauthorized", "send Authorization: Bearer <INTAKE_API_TOKEN>");
    });
    api.post("/v1/work-items", async (request, reply) => {
      const { created, view } = await work.submit(request.body);
      return reply.code(created ? 201 : 200).send(view);
    });
    api.get<{ Params: { id: string } }>("/v1/work-items/:id", async (request, reply) => {
      const found = await work.view(request.params.id);
      if (!found) return problem(reply, 404, "No such work item", `the server has no work item ${request.params.id}`);
      return found;
    });
  });
}

/** Slack signs the raw body, so this route reads it as text and hands it to the adapter's receive as it came. */
async function slackRoutes(app: FastifyInstance, work: Inbox, channel: Channel): Promise<void> {
  await app.register(async (hooks) => {
    hooks.removeAllContentTypeParsers();
    hooks.addContentTypeParser("*", { parseAs: "string" }, (_request, body, done) => done(null, body));
    hooks.post("/slack/events", async (request, reply) => {
      const body = String(request.body ?? "");
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(request.headers)) if (typeof value === "string") headers[name] = value;
      const lines = await channel.receive({ headers, body });
      if (!lines) return problem(reply, 401, "Unauthorized", "the Slack signature does not match");
      const payload = JSON.parse(body) as { type?: string; challenge?: string };
      if (payload.type === "url_verification") return { challenge: payload.challenge };
      for (const line of lines) {
        if (line.kind !== "work") continue;
        const { created, view } = await work.submit(line.workItem);
        const thread = view.workItem.origin.externalId;
        if (created && thread) await channel.reply(thread, `Received as work item ${view.workItem.id}.`);
      }
      return reply.code(200).send();
    });
  });
}

/** A submission the contract refuses is the caller's mistake (400), as is any error Fastify gives a 4xx status. */
const answerError = (error: Error & { statusCode?: number }, _request: unknown, reply: FastifyReply) =>
  error instanceof UsageError
    ? problem(reply, 400, "The request is not a work submission", error.message)
    : problem(reply, error.statusCode ?? 500, "The request failed", error.message);

function slackChannel(env: Env): Channel | undefined {
  const token = env.INTAKE_SLACK_TOKEN;
  if (!token) return undefined;
  return channelAdapter({
    command: env.INTAKE_SLACK_ADAPTER || "npx -y @opensoftware/channel-slack",
    apiUrl: env.INTAKE_SLACK_URL,
    token,
    signingSecret: required(env, "INTAKE_SLACK_SIGNING_SECRET", "the signing secret of the Slack app"),
  });
}

export async function serve(env: Env) {
  const apiToken = required(env, "INTAKE_API_TOKEN", "the token that callers of the API send");
  const channel = slackChannel(env);
  const now = () => nowOf(env.OSF_NOW);
  const store = await openStore(env.INTAKE_DATABASE_URL || undefined, env.OSF_DATA || ".intake");
  const warn = (text: string) => process.stderr.write(`intake: ${text}\n`);
  const work = inbox(store, { nats: env.INTAKE_NATS_URL || undefined, now, warn });
  await work.relay();

  const app = Fastify({ logger: false });
  app.setErrorHandler(answerError);
  await workItemRoutes(app, work, apiToken);
  if (channel) await slackRoutes(app, work, channel);

  const port = Number(env.PORT || 8080);
  await app.listen({ port, host: "0.0.0.0" });
  process.stdout.write(`intake serves the work item API on port ${port}\n`);
  const timer = setInterval(() => void work.relay(), RELAY_EVERY_MS);
  await new Promise<void>((resolve) => {
    process.once("SIGTERM", resolve);
    process.once("SIGINT", resolve);
  });
  clearInterval(timer);
  await app.close();
  await work.relay();
  await store.close();
  return { lines: [] };
}
