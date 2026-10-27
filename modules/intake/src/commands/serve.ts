// @ts-nocheck
// intake serve: the work item API, the webhooks of Slack, the forge and Sentry, the relay of the outbox every minute
// (ADR 0063, ADR 0065), and the foreman's run events, which move a work item on (ADR 0071). It runs until SIGTERM or
// SIGINT.
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { timingSafeEqual } from "node:crypto";
import { UsageError } from "@opensoftware/cli";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { type Channel, channelAdapter } from "../adapters/channel.ts";
import { forgeAdapter } from "../adapters/forge.ts";
import { subscribeToNats } from "../adapters/nats.ts";
import { openStore } from "../adapters/store.ts";
import { nowOf } from "../domain/time.ts";
import { RUN_SUBJECTS } from "../domain/view.ts";
import { workItemId } from "../domain/work-item.ts";
import { type Env, required } from "./env.ts";
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
  await app.register(async api => {
    api.addHook("onRequest", async (request, reply) => {
      if (!bearerMatches(request.headers.authorization, apiToken)) return problem(reply, 401, "Unauthorized", "send Authorization: Bearer <INTAKE_API_TOKEN>");
    });
    api.post("/v1/work-items", async (request, reply) => {
      const {
        created,
        view
      } = await work.submit(request.body);
      return reply.code(created ? 201 : 200).send(view);
    });
    api.get<{
      Querystring: {
        dedupeKey?: string;
      };
    }>("/v1/work-items", async (request, reply) => {
      const key = request.query.dedupeKey;
      if (!key) return problem(reply, 400, "No dedupe key", "name the work item with ?dedupeKey=<key>");
      const found = await work.view(workItemId(key));
      if (!found) return problem(reply, 404, "No such work item", `the server has no work item with the key ${key}`);
      return found;
    });
    api.get<{
      Params: {
        id: string;
      };
    }>("/v1/work-items/:id", async (request, reply) => {
      const found = await work.view(request.params.id);
      if (!found) return problem(reply, 404, "No such work item", `the server has no work item ${request.params.id}`);
      return found;
    });
  });
}

/** A submission the contract refuses is the caller's mistake (400), as is any error Fastify gives a 4xx status. */
const answerError = (error: Error & {
  statusCode?: number;
}, _request: unknown, reply: FastifyReply) => error instanceof UsageError ? problem(reply, 400, "The request is not a work submission", error.message) : problem(reply, error.statusCode ?? 500, "The request failed", error.message);
function slackChannel(env: Env): Channel | undefined {
  const token = env.INTAKE_SLACK_TOKEN;
  if (!token) return undefined;
  return channelAdapter({
    command: env.INTAKE_SLACK_ADAPTER || "npx -y @opensoftware/channel-slack",
    apiUrl: env.INTAKE_SLACK_URL,
    token,
    signingSecret: required(env, "INTAKE_SLACK_SIGNING_SECRET", "the signing secret of the Slack app")
  });
}
export async function serve(env: Env) {
  const apiToken = required(env, "INTAKE_API_TOKEN", "the token that callers of the API send");
  const channel = slackChannel(env);
  const now = () => nowOf(env.OSF_NOW);
  const store = await openStore(env.INTAKE_DATABASE_URL || undefined, env.OSF_DATA || ".intake");
  const warn = (text: string) => process.stderr.write(`intake: ${text}\n`);
  const nats = env.INTAKE_NATS_URL || undefined;
  const work = inbox(store, {
    nats,
    now,
    warn
  });
  await work.relay();
  // A finished run's pull requests are linked in the Slack threads of its work item.
  const follow = async (event: unknown) => {
    if (stryMutAct_9fa48("1")) {
      {}
    } else {
      stryCov_9fa48("1");
      for (const {
        thread,
        text
      } of await work.followRun(event)) await (stryMutAct_9fa48("2") ? channel.reply(thread, text) : (stryCov_9fa48("2"), channel?.reply(thread, text)));
    }
  };
  const unsubscribe = nats ? await subscribeToNats(nats, RUN_SUBJECTS, follow, warn) : undefined;
  const app = Fastify({
    logger: false
  });
  app.setErrorHandler(answerError);
  await workItemRoutes(app, work, apiToken);
  if (channel) await slackHook(app, work, channel);
  const webhookSecret = env.INTAKE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const forge = forgeAdapter(env.INTAKE_FORGE_ADAPTER || "npx -y @opensoftware/forge-github", webhookSecret);
    await forgeHook(app, work, forge, env.INTAKE_FORGE_LABEL || "factory");
  }
  if (env.INTAKE_SENTRY_SECRET) await sentryHook(app, work, env.INTAKE_SENTRY_SECRET, env.INTAKE_SENTRY_CHANGE_URL || undefined);
  const port = Number(env.PORT || 8080);
  await app.listen({
    port,
    host: "0.0.0.0"
  });
  process.stdout.write(`intake serves the work item API on port ${port}\n`);
  const timer = setInterval(() => void work.relay(), RELAY_EVERY_MS);
  await new Promise<void>(resolve => {
    process.once("SIGTERM", resolve);
    process.once("SIGINT", resolve);
  });
  clearInterval(timer);
  await unsubscribe?.();
  await app.close();
  await work.relay();
  await store.close();
  return {
    lines: []
  };
}