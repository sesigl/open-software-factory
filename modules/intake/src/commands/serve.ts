// intake serve: the work item API, the webhooks of Slack, the forge and Sentry, the relay of the outbox every minute
// (ADR 0063, ADR 0065), and the foreman's run events, which move a work item on (ADR 0071). It runs until SIGTERM or
// SIGINT.
import { timingSafeEqual } from "node:crypto";
import { healthOf, UsageError } from "@opensoftware/cli";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { type Channel, channelAdapter } from "../adapters/channel.ts";
import { type Forge, forgeAdapter } from "../adapters/forge.ts";
import { type NatsAt, subscribeToNats } from "../adapters/nats.ts";
import { openStore } from "../adapters/store.ts";
import { nowOf } from "../domain/time.ts";
import { inboxPageOf, RUN_SUBJECTS } from "../domain/view.ts";
import { workItemId } from "../domain/work-item.ts";
import { durationOf, type Env, required } from "./env.ts";
import { forgeHook, problem, sentryHook, slackHook } from "./hooks.ts";
import { type Inbox, inbox } from "./inbox.ts";

const RELAY_EVERY_MS = 60_000;

/** Compares in constant time, so the answer's timing does not tell how much of a token was right. */
function bearerMatches(header: string | undefined, token: string): boolean {
  const sent = Buffer.from(header ?? "");
  const wanted = Buffer.from(`Bearer ${token}`);
  return sent.length === wanted.length && timingSafeEqual(sent, wanted);
}

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
    api.get<{ Querystring: { dedupeKey?: string } }>("/v1/work-items", async (request, reply) => {
      const key = request.query.dedupeKey;
      if (!key) return problem(reply, 400, "No dedupe key", "name the work item with ?dedupeKey=<key>");
      const found = await work.view(workItemId(key));
      if (!found) return problem(reply, 404, "No such work item", `the server has no work item with the key ${key}`);
      return found;
    });
    api.get<{ Querystring: { status?: string; limit?: string; cursor?: string } }>(
      "/v1/inbox",
      async (request, reply) => {
        const page = inboxPageOf(request.query);
        if (typeof page === "string") return problem(reply, 400, "Bad query", page);
        return work.latest(page);
      },
    );
    api.get<{ Params: { id: string } }>("/v1/work-items/:id", async (request, reply) => {
      const found = await work.view(request.params.id);
      if (!found) return problem(reply, 404, "No such work item", `the server has no work item ${request.params.id}`);
      return found;
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

/** The forge adapter, with INTAKE_WEBHOOK_SECRET; it comments on issues with INTAKE_FORGE_TOKEN. */
function forgeOf(env: Env): Forge | undefined {
  const webhookSecret = env.INTAKE_WEBHOOK_SECRET;
  if (!webhookSecret) return undefined;
  return forgeAdapter({
    command: env.INTAKE_FORGE_ADAPTER || "npx -y @opensoftware/forge-github",
    webhookSecret,
    url: env.INTAKE_FORGE_URL,
    token: env.INTAKE_FORGE_TOKEN,
  });
}

/** The NATS server of INTAKE_NATS_URL, with the stream's age of OSF_STREAM_MAX_AGE (ADR 0116). */
export function natsOf(env: Env): NatsAt | undefined {
  const maxAgeMs = durationOf(env, "OSF_STREAM_MAX_AGE");
  return env.INTAKE_NATS_URL ? { url: env.INTAKE_NATS_URL, maxAgeMs } : undefined;
}

export async function serve(env: Env) {
  const apiToken = required(env, "INTAKE_API_TOKEN", "the token that callers of the API send");
  const channel = slackChannel(env);
  const forge = forgeOf(env);
  const now = () => nowOf(env.OSF_NOW);
  const store = await openStore(env.INTAKE_DATABASE_URL || undefined, env.OSF_DATA || ".intake");
  const warn = (text: string) => process.stderr.write(`intake: ${text}\n`);
  const nats = natsOf(env);
  const say = (text: string) => process.stdout.write(`${text}\n`);
  const keepMs = durationOf(env, "INTAKE_OUTBOX_KEEP") ?? 7 * 86_400_000;
  const work = inbox(store, { nats, console: env.INTAKE_CONSOLE_URL || undefined, now, keepMs, say, warn });
  await work.relay();
  // The Slack threads and the issues of a work item hear when its run waits at a gate or for its checks and when it ended (ADR 0113, 0127).
  // A reply that fails is a warning, so the event does not come again to the places that heard of it.
  const issues = env.INTAKE_FORGE_TOKEN ? forge : undefined;
  const follow = async (event: unknown) => {
    for (const { to, at, text } of await work.followRun(event))
      await (to === "slack" ? channel?.reply(at, text) : issues?.comment(at, text))?.catch((error: Error) =>
        warn(`no reply on ${at}: ${error.message}`),
      );
    await work.told(event);
  };
  const subscription = nats ? await subscribeToNats(nats, RUN_SUBJECTS, follow, warn) : undefined;

  const app = Fastify({ logger: false });
  app.setErrorHandler(answerError);
  app.get("/v1/health", async (_request, reply) => {
    const health = await healthOf([
      { name: "database", check: () => store.ping(), fix: "check INTAKE_DATABASE_URL and that the database runs" },
      ...(subscription
        ? [
            {
              name: "nats",
              // The check also fails while dead letters wait (ADR 0116).
              check: async () => {
                await subscription.ping();
                const waiting = await subscription.deadLetters();
                if (waiting)
                  throw new Error(
                    `${waiting} run events failed 5 times and wait on osf.dead.intake.>; fix the cause the warnings name, then run "intake resend"`,
                  );
              },
              fix: "check INTAKE_NATS_URL, and that NATS runs with JetStream",
            },
          ]
        : []),
    ]);
    return reply.code(health.status === "ok" ? 200 : 503).send(health);
  });
  await workItemRoutes(app, work, apiToken);
  if (channel) await slackHook(app, work, channel);
  if (forge) await forgeHook(app, work, forge, env.INTAKE_FORGE_LABEL || "factory");
  if (env.INTAKE_SENTRY_SECRET)
    await sentryHook(app, work, env.INTAKE_SENTRY_SECRET, env.INTAKE_SENTRY_CHANGE_URL || undefined);

  const port = Number(env.PORT || 8080);
  await app.listen({ port, host: "0.0.0.0" });
  process.stdout.write(`intake serves the work item API on port ${port}\n`);
  const timer = setInterval(() => void work.relay(), RELAY_EVERY_MS);
  await new Promise<void>((resolve) => {
    process.once("SIGTERM", resolve);
    process.once("SIGINT", resolve);
  });
  clearInterval(timer);
  await subscription?.stop();
  await app.close();
  await work.relay();
  await store.close();
  return { lines: [] };
}
