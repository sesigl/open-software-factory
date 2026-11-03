// gatekeeper serve: the gate API over HTTP, Slack's Events API and button presses through the channel adapter, a
// check of the pending gates every minute (ADR 0048, ADR 0062), and with the forge token a read of the pull requests'
// comments every GATEKEEPER_POLL_MS (ADR 0080). It runs until SIGTERM or SIGINT.
import { timingSafeEqual } from "node:crypto";
import { UsageError } from "@opensoftware/cli";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { readJson, readText } from "../adapters/files.ts";
import { openStore } from "../adapters/postgres.ts";
import { receive } from "../adapters/slack.ts";
import { pullRequestOf } from "../domain/pull-request.ts";
import { buildRecord, signWith } from "../domain/record.ts";
import { parseRequest } from "../domain/request.ts";
import { viewOf } from "../domain/stored.ts";
import { type Decision, gates } from "./gates.ts";
import { forgeFor, nowOf, slackOf } from "./load.ts";

export interface ServeOptions {
  policy: string;
  groups: string;
  channel?: string;
  env: Record<string, string | undefined>;
}

const CHECK_EVERY_MS = 60_000;
const POLL_MS = 30_000;

function required(env: ServeOptions["env"], name: string, what: string): string {
  const value = env[name];
  if (!value) throw new UsageError(`set ${name}: ${what}`);
  return value;
}

/** An error answer in the shape of RFC 9457. */
const problem = (reply: FastifyReply, status: number, title: string, detail?: string) =>
  reply.code(status).type("application/problem+json").send({ title, status, detail });

export async function serve(options: ServeOptions) {
  const { env } = options;
  const pullRequests = Boolean(env.GATEKEEPER_FORGE_TOKEN);
  if (options.channel === undefined && !pullRequests)
    throw new UsageError(
      "serve needs a Slack channel, like --channel slack:C0GATES, or GATEKEEPER_FORGE_TOKEN for the pull requests that requests link",
    );
  if (options.channel !== undefined && !/^slack:[A-Z0-9]+$/.test(options.channel))
    throw new UsageError("serve needs a Slack channel, like --channel slack:C0GATES");
  const database = required(env, "GATEKEEPER_DATABASE_URL", "the PostgreSQL database of the gates");
  const apiToken = required(env, "GATEKEEPER_API_TOKEN", "the token that callers of the API send");
  if (options.channel !== undefined) {
    required(env, "GATEKEEPER_SLACK_TOKEN", "the Slack bot token");
    required(env, "GATEKEEPER_SLACK_SIGNING_SECRET", "the signing secret of the Slack app");
  }
  const pollMs = Number(env.GATEKEEPER_POLL_MS || POLL_MS);
  if (!Number.isInteger(pollMs) || pollMs <= 0)
    throw new UsageError("set GATEKEEPER_POLL_MS to a number of milliseconds, like 30000");
  const policyText = readText(options.policy);
  const groups = readJson(options.groups);
  const now = () => nowOf(env.OSF_NOW);
  const signingKey = env.GATEKEEPER_SIGNING_KEY || undefined;
  checkKey(signingKey);

  const store = await openStore(database);
  const slack = options.channel === undefined ? undefined : slackOf(options.channel, env);
  const service = gates(
    {
      policy: options.policy,
      policyText,
      groupsFile: options.groups,
      groups,
      slack,
      forge: pullRequests ? (pr) => forgeFor(pr, env) : undefined,
      opa: env.GATEKEEPER_OPA || "opa",
      signingKey,
      nats: env.GATEKEEPER_NATS_URL || undefined,
      now,
      warn: (text) => process.stderr.write(`gatekeeper: ${text}\n`),
    },
    store,
  );
  await service.check();

  const app = Fastify({ logger: false });
  app.setErrorHandler((error: { statusCode?: number; message: string }, _request, reply) => {
    if (error instanceof UsageError) return problem(reply, 400, "The request is not a gate request", error.message);
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    return problem(reply, status, status === 500 ? "The server failed" : "Bad request", error.message);
  });
  app.setNotFoundHandler((request, reply) => problem(reply, 404, "Not found", `${request.method} ${request.url}`));

  await app.register(async (api) => {
    const expected = Buffer.from(`Bearer ${apiToken}`);
    api.addHook("onRequest", async (request, reply) => {
      const given = Buffer.from(request.headers.authorization ?? "");
      if (given.length !== expected.length || !timingSafeEqual(given, expected))
        return problem(reply, 401, "Unauthorized", "send Authorization: Bearer <GATEKEEPER_API_TOKEN>");
    });
    api.post("/v1/gates", async (request, reply) => {
      const { created, gate } = await service.request(parseRequest(request.body, "the request"));
      return reply.code(created ? 201 : 200).send(viewOf(gate));
    });
    api.get<{ Params: { gateId: string } }>("/v1/gates/:gateId", async (request, reply) => {
      const gate = await service.get(request.params.gateId);
      if (!gate) return problem(reply, 404, "No such gate", `the server has no gate ${request.params.gateId}`);
      return viewOf(gate);
    });
  });

  if (slack) await app.register(slackRoutes(slack, service));

  const port = Number(env.PORT || 8080);
  await app.listen({ port, host: "0.0.0.0" });
  const served = [slack?.name, pullRequests ? "pull requests" : undefined].filter(Boolean).join(" and ");
  process.stdout.write(`gatekeeper serves ${served} on port ${port}\n`);
  const warn = (error: Error): void => {
    process.stderr.write(`gatekeeper: the check of the pending gates failed: ${error.message}\n`);
  };
  const timer = setInterval(() => void service.check().catch(warn), CHECK_EVERY_MS);
  // A pull request sends no event: the server reads the comments of its pending gates, one read at a time.
  let polling: Promise<void> | undefined;
  const poll = pullRequests
    ? setInterval(() => {
        polling ??= service
          .check((name) => pullRequestOf(name) !== undefined)
          .catch(warn)
          .finally(() => {
            polling = undefined;
          });
      }, pollMs)
    : undefined;
  await new Promise<void>((resolve) => {
    process.once("SIGTERM", resolve);
    process.once("SIGINT", resolve);
  });
  clearInterval(timer);
  clearInterval(poll);
  await polling;
  await app.close();
  await service.idle();
  await store.close();
  return { lines: [] };
}

/** Slack's Events API and interactivity, checked by the channel adapter's receive. */
function slackRoutes(channel: ReturnType<typeof slackOf>, service: ReturnType<typeof gates>) {
  return async (hooks: FastifyInstance) => {
    // Slack signs the raw body, so these routes read it as text and hand it to the adapter's receive as it came.
    hooks.removeAllContentTypeParsers();
    hooks.addContentTypeParser("*", { parseAs: "string" }, (_request, body, done) => done(null, body));
    const received = async (request: FastifyRequest, reply: FastifyReply) => {
      const body = String(request.body ?? "");
      const headers = Object.fromEntries(
        Object.entries(request.headers).flatMap(([name, value]) => (typeof value === "string" ? [[name, value]] : [])),
      );
      const lines = await receive(channel.run, { headers, body });
      if (!lines) problem(reply, 401, "Unauthorized", "the Slack signature does not match");
      return lines;
    };
    hooks.post("/slack/events", async (request, reply) => {
      const lines = await received(request, reply);
      if (!lines) return reply;
      const payload = JSON.parse(String(request.body)) as { type?: string; challenge?: string };
      if (payload.type === "url_verification") return { challenge: payload.challenge };
      // A reply mentions no bot, so receive prints nothing for it: the server reads the pending gates' threads again.
      if (payload.type === "event_callback") await service.check();
      return reply.code(200).send();
    });
    hooks.post("/slack/actions", async (request, reply) => {
      const lines = await received(request, reply);
      if (!lines) return reply;
      for (const line of lines) if (line.kind === "decision") await service.decision(line as unknown as Decision);
      return reply.code(200).send();
    });
  };
}

/** A key that cannot sign stops the server before it starts, not at the first decision. */
function checkKey(key: string | undefined): void {
  if (!key) return;
  const outcome = { state: "expired", at: 0 } as const;
  const gate = {
    id: "g0000000000000000",
    request: { workItem: "check", stage: "check", summary: "check", links: [], change: {} },
    rules: { approvers: [] },
    groups: {},
    policy: "check",
  };
  signWith(buildRecord(gate, { policyText: "", channel: "check", requestedAt: 0 }, outcome), key);
}
