// gatekeeper serve: the gate API over HTTP, Slack's Events API and button presses, and a check of the pending gates
// every minute (ADR 0048). It runs until SIGTERM or SIGINT.
import { timingSafeEqual } from "node:crypto";
import { UsageError } from "@opensoftware/cli";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { readJson, readText, withDelivery } from "../adapters/files.ts";
import { slackChannel } from "../adapters/ports.ts";
import { openStore } from "../adapters/postgres.ts";
import { buildRecord, signWith } from "../domain/record.ts";
import { parseRequest } from "../domain/request.ts";
import { viewOf } from "../domain/stored.ts";
import { gates } from "./gates.ts";
import { nowOf, slackAdapter, slackName } from "./load.ts";

export interface ServeOptions {
  policy: string;
  groups: string;
  channel?: string;
  env: Record<string, string | undefined>;
}

const CHECK_EVERY_MS = 60_000;

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
  if (!/^slack:/.test(options.channel ?? ""))
    throw new UsageError("serve needs a Slack channel, like --channel slack:C0GATES");
  const name = slackName(options.channel);
  const database = required(env, "GATEKEEPER_DATABASE_URL", "the PostgreSQL database of the gates");
  const apiToken = required(env, "GATEKEEPER_API_TOKEN", "the token that callers of the API send");
  required(env, "GATEKEEPER_SLACK_TOKEN", "the Slack bot token");
  required(env, "GATEKEEPER_SLACK_SIGNING_SECRET", "the signing secret of the Slack app");
  const policyText = readText(options.policy);
  const groups = readJson(options.groups);
  const now = () => nowOf(env.OSF_NOW);
  const signingKey = env.GATEKEEPER_SIGNING_KEY || undefined;
  checkKey(signingKey);

  const store = await openStore(database);
  const channel = slackChannel(name, slackAdapter(env));
  const service = gates(
    {
      policy: options.policy,
      policyText,
      groupsFile: options.groups,
      groups,
      channel,
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

  await app.register(async (hooks) => {
    // Slack signs the raw body, so these routes read it as text.
    hooks.removeAllContentTypeParsers();
    hooks.addContentTypeParser("*", { parseAs: "string" }, (_request, body, done) => done(null, body));
    /**
     * Hands Slack's request to the channel port's receive, which checks its signature; a refused signature gets 401.
     * Gives the body once receive took it.
     */
    const received = async (request: FastifyRequest, reply: FastifyReply): Promise<string | undefined> => {
      const body = String(request.body ?? "");
      const headers = Object.fromEntries(
        Object.entries(request.headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(", ") : String(value),
        ]),
      );
      try {
        await withDelivery({ headers, body }, (file) => service.delivery(file));
        return body;
      } catch (error) {
        if (!/signature/.test((error as Error).message)) throw error;
        problem(reply, 401, "Unauthorized", (error as Error).message);
        return undefined;
      }
    };
    hooks.post("/slack/events", async (request, reply) => {
      const body = await received(request, reply);
      if (body === undefined) return reply;
      const payload = JSON.parse(body) as { type?: string; challenge?: string };
      if (payload.type === "url_verification") return { challenge: payload.challenge };
      return reply.code(200).send();
    });
    hooks.post("/slack/actions", async (request, reply) => {
      if ((await received(request, reply)) === undefined) return reply;
      return reply.code(200).send();
    });
  });

  const port = Number(env.PORT || 8080);
  await app.listen({ port, host: "0.0.0.0" });
  process.stdout.write(`gatekeeper serves ${channel.name} on port ${port}\n`);
  const warn = (error: Error) =>
    process.stderr.write(`gatekeeper: the check of the pending gates failed: ${error.message}\n`);
  const timer = setInterval(() => void service.check().catch(warn), CHECK_EVERY_MS);
  await new Promise<void>((resolve) => {
    process.once("SIGTERM", resolve);
    process.once("SIGINT", resolve);
  });
  clearInterval(timer);
  await app.close();
  await service.idle();
  await store.close();
  return { lines: [] };
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
