// foreman serve: the run API on PORT and a Temporal worker that runs the factory's workflow (ADR 0067). With
// FOREMAN_NATS_URL it also starts runs for work.received@v1 and passes gate.decided@v1 to the waiting runs. It runs
// until SIGTERM or SIGINT.
import { timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UsageError } from "@opensoftware/cli";
import type { GateDecided, WorkItem } from "@opensoftware/contracts";
import { Client, Connection } from "@temporalio/client";
import { NativeConnection, Worker } from "@temporalio/worker";
import Fastify, { type FastifyReply } from "fastify";
import { readFactory } from "../adapters/factory.ts";
import { gatekeeper } from "../adapters/gatekeeper.ts";
import { type Bus, openBus, SUBJECTS } from "../adapters/nats.ts";
import { isoNow } from "../domain/time.ts";
import { activities } from "../workflows/activities.ts";
import { Conflict, type Runs, runs } from "./runs.ts";

export type Env = Record<string, string | undefined>;

const BUNDLE = fileURLToPath(new URL("../workflows.bundle.js", import.meta.url));

const problem = (reply: FastifyReply, status: number, title: string, detail: string) =>
  reply.code(status).type("application/problem+json").send({ title, status, detail });

/** Whether the request carries the token; compared in constant time. */
function authorized(header: string | undefined, token: string): boolean {
  const [sent, wanted] = [Buffer.from(header ?? ""), Buffer.from(`Bearer ${token}`)];
  return sent.length === wanted.length && timingSafeEqual(sent, wanted);
}

function api(work: Runs, token: string) {
  const app = Fastify();
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (error instanceof UsageError) return problem(reply, 400, "Bad request", error.message);
    if (error instanceof Conflict) return problem(reply, 409, "The run ended", error.message);
    return problem(reply, error.statusCode ?? 500, "The request failed", error.message);
  });
  app.addHook("onRequest", async (request, reply) => {
    if (!authorized(request.headers.authorization, token))
      return problem(reply, 401, "Unauthorized", "send Authorization: Bearer <FOREMAN_API_TOKEN>");
  });
  const unknown = (reply: FastifyReply, runId: string) =>
    problem(reply, 404, "No such run", `the server has no run ${runId}`);
  app.post("/v1/runs", async (request, reply) => {
    const { created, view } = await work.start(request.body);
    return reply.code(created ? 201 : 200).send(view);
  });
  app.get<{ Params: { runId: string } }>("/v1/runs/:runId", async (request, reply) => {
    const view = await work.view(request.params.runId);
    return view ?? unknown(reply, request.params.runId);
  });
  app.post<{ Params: { runId: string } }>("/v1/runs/:runId/signals", async (request, reply) => {
    const view = await work.signal(request.params.runId, request.body);
    return view ? reply.code(202).send(view) : unknown(reply, request.params.runId);
  });
  return app;
}

/** Starts runs for work items from intake and hands gate decisions to the runs that wait for them. */
function listen(bus: Bus, work: Runs): void {
  bus.subscribe(SUBJECTS.workReceived, async (event) => {
    await work.start((event as { data?: WorkItem }).data);
  });
  bus.subscribe(SUBJECTS.gateDecided, async (event) => {
    const { data } = event as GateDecided;
    await work.decided(data.workItemId, { gateId: data.gateId, state: data.decision });
  });
}

export async function serve(env: Env) {
  const token = env.FOREMAN_API_TOKEN;
  if (!token) throw new UsageError("set FOREMAN_API_TOKEN: the token that callers of the API send");
  const factoryPath = resolve(env.FOREMAN_FACTORY || "factory.yaml");
  await readFactory(factoryPath);
  const now = () => isoNow(env.OSF_NOW);
  const warn = (text: string) => process.stderr.write(`foreman: ${text}\n`);
  const address = env.FOREMAN_TEMPORAL_ADDRESS || "localhost:7233";
  // Unset, the client and the worker use the namespace "default".
  const namespace = env.FOREMAN_TEMPORAL_NAMESPACE;
  const taskQueue = env.FOREMAN_TASK_QUEUE || "foreman";
  const pollMs = Number(env.FOREMAN_POLL_MS || 1000);
  const bus = env.FOREMAN_NATS_URL ? await openBus(env.FOREMAN_NATS_URL, warn) : undefined;

  const client = new Client({ connection: await Connection.connect({ address }), namespace });
  const work = runs({ client, taskQueue, factory: () => readFactory(factoryPath), now });
  const worker = await Worker.create({
    connection: await NativeConnection.connect({ address }),
    namespace,
    taskQueue,
    workflowBundle: { codePath: BUNDLE },
    activities: activities({
      now,
      bus,
      gatekeeper: gatekeeper(env.FOREMAN_GATEKEEPER_URL, env.FOREMAN_GATEKEEPER_TOKEN),
      harnesses: JSON.parse(env.FOREMAN_HARNESSES || "{}") as Record<string, string>,
      sandboxes: JSON.parse(env.FOREMAN_SANDBOXES || "{}") as Record<string, string>,
      forges: JSON.parse(env.FOREMAN_FORGES || "{}") as Record<string, string>,
      forgeEnv: {
        ...(env.FOREMAN_FORGE_URL ? { FORGE_URL: env.FOREMAN_FORGE_URL } : {}),
        ...(env.FOREMAN_FORGE_TOKEN ? { FORGE_TOKEN: env.FOREMAN_FORGE_TOKEN } : {}),
      },
      checkPollMs: Number(env.FOREMAN_CHECK_POLL_MS || 30_000),
      data: resolve(env.OSF_DATA || ".foreman"),
      pollMs,
      steering: (runId) => work.steering(runId),
      env,
    }),
    maxHeartbeatThrottleInterval: pollMs,
    defaultHeartbeatThrottleInterval: pollMs,
  });
  const running = worker.run();
  if (bus) listen(bus, work);

  const app = api(work, token);
  const port = Number(env.PORT || 8080);
  await app.listen({ port, host: "0.0.0.0" });
  process.stdout.write(`foreman serves the run API on port ${port}, task queue ${taskQueue} at ${address}\n`);
  // Temporal's runtime stops the worker on SIGTERM and SIGINT; the server stops with it.
  await running;
  await app.close();
  await bus?.close();
  return { lines: [] };
}
