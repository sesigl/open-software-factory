// foreman serve: the run API on PORT and a Temporal worker that runs the factory's workflow (ADR 0067). With
// FOREMAN_NATS_URL it also starts runs for work.received@v1, runs a run again for work.retry-requested@v1, and passes gate.decided@v1 to the waiting runs. A factory
// with an inference adapter gets its gateway while the server runs (ADR 0070). It runs until SIGTERM or SIGINT.
import { timingSafeEqual } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Health, healthOf, UsageError } from "@opensoftware/cli";
import type { GateDecided, WorkItem, WorkRetryRequested } from "@opensoftware/contracts";
import { Client, Connection, WorkflowNotFoundError } from "@temporalio/client";
import { NativeConnection, Worker } from "@temporalio/worker";
import Fastify, { type FastifyReply } from "fastify";
import { readFactory } from "../adapters/factory.ts";
import { gatekeeper } from "../adapters/gatekeeper.ts";
import { type Attached, attachGateway, startGateway } from "../adapters/inference.ts";
import { type Bus, openBus, SUBJECTS } from "../adapters/nats.ts";
import { exporterOf } from "../adapters/otlp.ts";
import type { Definition } from "../domain/definition.ts";
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

function api(work: Runs, token: string, health: () => Promise<Health>) {
  const app = Fastify();
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (error instanceof UsageError) return problem(reply, 400, "Bad request", error.message);
    if (error instanceof Conflict) return problem(reply, 409, error.title, error.message);
    return problem(reply, error.statusCode ?? 500, "The request failed", error.message);
  });
  // The health route needs no token (ADR 0086).
  app.get("/v1/health", async (_request, reply) => {
    const answer = await health();
    return reply.code(answer.status === "ok" ? 200 : 503).send(answer);
  });
  app.addHook("onRequest", async (request, reply) => {
    if (request.routeOptions.url === "/v1/health") return;
    if (!authorized(request.headers.authorization, token))
      return problem(reply, 401, "Unauthorized", "send Authorization: Bearer <FOREMAN_API_TOKEN>");
  });
  const unknown = (reply: FastifyReply, runId: string) =>
    problem(reply, 404, "No such run", `the server has no run ${runId}`);
  app.post("/v1/runs", async (request, reply) => {
    const { created, view } = await work.start(request.body);
    return reply.code(created ? 201 : 200).send(view);
  });
  app.get<{ Querystring: { state?: string } }>("/v1/runs", async (request) => ({
    runs: await work.list(request.query.state),
  }));
  app.get<{ Params: { runId: string } }>("/v1/runs/:runId", async (request, reply) => {
    const view = await work.view(request.params.runId);
    return view ?? unknown(reply, request.params.runId);
  });
  app.post<{ Params: { runId: string } }>("/v1/runs/:runId/signals", async (request, reply) => {
    const view = await work.signal(request.params.runId, request.body);
    return view ? reply.code(202).send(view) : unknown(reply, request.params.runId);
  });
  app.post<{ Params: { runId: string } }>("/v1/runs/:runId/retry", async (request, reply) => {
    const view = await work.retry(request.params.runId, request.body);
    return view ? reply.code(201).send(view) : unknown(reply, request.params.runId);
  });
  return app;
}

/**
 * Starts runs for work items from intake, runs a run again when intake asks (ADR 0105), and hands gate decisions to the
 * runs that wait for them, through the durable consumer "foreman" (ADR 0085). An event that can never succeed, a work
 * item that is not valid, a decision for a run that does not exist, or a retry of a run that cannot run again, is a
 * warning and is acknowledged; another failure comes again.
 */
function listen(bus: Bus, work: Runs, warn: (text: string) => void): Promise<void> {
  const subjects = [SUBJECTS.workReceived, SUBJECTS.workRetryRequested, SUBJECTS.gateDecided];
  return bus.consume("foreman", subjects, async (event, subject) => {
    const { data } = event as { data?: unknown };
    try {
      if (subject === SUBJECTS.gateDecided) {
        const { workItemId, gateId, decision } = data as GateDecided["data"];
        await work.decided(workItemId, { gateId, state: decision });
      } else if (subject === SUBJECTS.workRetryRequested) {
        const { runId, requester } = data as WorkRetryRequested["data"];
        if (!(await work.retry(runId, { by: requester }))) warn(`${subject}: the server has no run ${runId}`);
      } else await work.start(data as WorkItem);
    } catch (failure) {
      if (!(failure instanceof UsageError || failure instanceof WorkflowNotFoundError || failure instanceof Conflict))
        throw failure;
      warn(`${subject}: ${failure.message}`);
    }
  });
}

export async function serve(env: Env) {
  const token = env.FOREMAN_API_TOKEN;
  if (!token) throw new UsageError("set FOREMAN_API_TOKEN: the token that callers of the API send");
  const factoryPath = resolve(env.FOREMAN_FACTORY || "factory.yaml");
  const { definition } = await readFactory(factoryPath);
  const now = () => isoNow(env.OSF_NOW);
  const warn = (text: string) => process.stderr.write(`foreman: ${text}\n`);
  const address = env.FOREMAN_TEMPORAL_ADDRESS || "localhost:7233";
  // Unset, the client and the worker use the namespace "default".
  const namespace = env.FOREMAN_TEMPORAL_NAMESPACE;
  const taskQueue = env.FOREMAN_TASK_QUEUE || "foreman";
  const pollMs = Number(env.FOREMAN_POLL_MS || 1000);
  const bus = env.FOREMAN_NATS_URL ? await openBus(env.FOREMAN_NATS_URL, warn) : undefined;
  const traces = exporterOf(env);

  // The gateway starts in the background, so the server does not wait for it (ADR 0099).
  const retryMs = Number(env.FOREMAN_INFERENCE_RETRY_MS || 1000);
  const data = resolve(env.OSF_DATA || ".foreman");
  const gatewayFolder = join(data, "inference");
  const gateway = gatewayOf(definition.inference, dirname(factoryPath), gatewayFolder, env, retryMs, warn);
  // A gateway stops with the server, also when the server cannot start.
  try {
    const temporal = await Connection.connect({ address });
    const client = new Client({ connection: temporal, namespace });
    const stopping = new AbortController();
    const work = runs({ client, taskQueue, factory: () => readFactory(factoryPath), now, stopping: stopping.signal });
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
        sandbox: env.FOREMAN_SANDBOX || "docker",
        forges: JSON.parse(env.FOREMAN_FORGES || "{}") as Record<string, string>,
        forgeEnv: {
          ...(env.FOREMAN_FORGE_URL ? { FORGE_URL: env.FOREMAN_FORGE_URL } : {}),
          ...(env.FOREMAN_FORGE_TOKEN ? { FORGE_TOKEN: env.FOREMAN_FORGE_TOKEN } : {}),
        },
        waits: {
          checkPollMs: Number(env.FOREMAN_CHECK_POLL_MS || 30_000),
          checkTimeoutMs: Number(env.FOREMAN_CHECK_TIMEOUT_MS || 7_200_000),
          gateTimeoutMs: Number(env.FOREMAN_GATE_TIMEOUT_MS || 604_800_000),
        },
        data,
        pollMs,
        control: (runId) => work.control(runId),
        ...(gateway ? { gateway: gateway.gateway, gatewayFolder } : {}),
        ...(traces ? { traces } : {}),
        warn,
        env,
      }),
      maxHeartbeatThrottleInterval: pollMs,
      defaultHeartbeatThrottleInterval: pollMs,
      // At SIGTERM a short activity may end; after this time the worker cancels the running stages (ADR 0101).
      shutdownGraceTime: "1 second",
    });
    const running = worker.run();
    if (bus) await listen(bus, work, warn);

    const app = api(work, token, () =>
      healthOf([
        {
          name: "temporal",
          check: async () => {
            await temporal.workflowService.getSystemInfo({});
          },
          fix: `check FOREMAN_TEMPORAL_ADDRESS (${address}) and that Temporal runs`,
        },
        ...(bus
          ? [
              {
                name: "nats",
                check: () => bus.ping(),
                fix: "check FOREMAN_NATS_URL and that NATS runs",
              },
            ]
          : []),
        ...(gateway
          ? [
              {
                name: "inference",
                check: () => gateway.check(),
                fix: "check the factory's inference config and that its gateway runs",
              },
            ]
          : []),
      ]),
    );

    const port = Number(env.PORT || 8080);
    await app.listen({ port, host: "0.0.0.0" });
    process.stdout.write(`foreman serves the run API on port ${port}, task queue ${taskQueue} at ${address}\n`);
    // Temporal's runtime stops the worker on SIGTERM and SIGINT; the server stops with it.
    await running;
    stopping.abort();
    await app.close();
    await bus?.close();
    await temporal.close();
  } finally {
    await gateway?.stop();
  }
  return { lines: [] };
}

/** The gateway of the factory's inference adapter from its config, a path relative to the factory's folder. */
function gatewayOf(
  inference: Definition["inference"],
  folder: string,
  gatewayFolder: string,
  env: Env,
  retryMs: number,
  warn: (text: string) => void,
): Attached | undefined {
  if (!inference) return undefined;
  const lines = JSON.parse(env.FOREMAN_INFERENCES || "{}") as Record<string, string>;
  const adapter = lines[inference.adapter] ?? `npx -y @opensoftware/inference-${inference.adapter}`;
  return attachGateway(
    () => startGateway(adapter.split(" "), resolve(folder, inference.config), env, gatewayFolder),
    retryMs,
    warn,
  );
}
