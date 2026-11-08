// foreman serve: the run API on PORT and a Temporal worker that runs the factory's workflow (ADR 0067). With
// FOREMAN_NATS_URL it also starts runs for work.received@v1 and passes gate.decided@v1 to the waiting runs. A factory
// with an inference adapter gets its gateway while the server runs (ADR 0070). It runs until SIGTERM or SIGINT.
import { timingSafeEqual } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Health, healthOf, UsageError } from "@opensoftware/cli";
import type { GateDecided, WorkItem } from "@opensoftware/contracts";
import { Client, Connection, WorkflowNotFoundError } from "@temporalio/client";
import { NativeConnection, Worker } from "@temporalio/worker";
import Fastify, { type FastifyReply } from "fastify";
import { readFactory } from "../adapters/factory.ts";
import { gatekeeper } from "../adapters/gatekeeper.ts";
import { type Gateway, startGateway } from "../adapters/inference.ts";
import { type Bus, openBus, SUBJECTS } from "../adapters/nats.ts";
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
  return app;
}

/**
 * Starts runs for work items from intake and hands gate decisions to the runs that wait for them, through the durable
 * consumer "foreman" (ADR 0085). An event that can never succeed, a work item that is not valid or a decision for a run
 * that does not exist, is a warning and is acknowledged; another failure comes again.
 */
function listen(bus: Bus, work: Runs, warn: (text: string) => void): Promise<void> {
  return bus.consume("foreman", [SUBJECTS.workReceived, SUBJECTS.gateDecided], async (event, subject) => {
    const { data } = event as { data?: unknown };
    try {
      if (subject === SUBJECTS.gateDecided) {
        const { workItemId, gateId, decision } = data as GateDecided["data"];
        await work.decided(workItemId, { gateId, state: decision });
      } else await work.start(data as WorkItem);
    } catch (failure) {
      if (!(failure instanceof UsageError || failure instanceof WorkflowNotFoundError)) throw failure;
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

  const gateway = await gatewayOf(definition.inference, dirname(factoryPath), env);
  // A gateway stops with the server, also when the server cannot start.
  try {
    const temporal = await Connection.connect({ address });
    const client = new Client({ connection: temporal, namespace });
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
        control: (runId) => work.control(runId),
        ...(gateway ? { gateway } : {}),
        env,
      }),
      maxHeartbeatThrottleInterval: pollMs,
      defaultHeartbeatThrottleInterval: pollMs,
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
                check: async () => {
                  if (!bus.connected()) throw new Error("the connection to NATS is down");
                },
                fix: "check FOREMAN_NATS_URL and that NATS runs",
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
    await app.close();
    await bus?.close();
  } finally {
    await gateway?.stop();
  }
  return { lines: [] };
}

/** Starts the gateway of the factory's inference adapter from its config, a path relative to the factory's folder. */
async function gatewayOf(inference: Definition["inference"], folder: string, env: Env): Promise<Gateway | undefined> {
  if (!inference) return undefined;
  const lines = JSON.parse(env.FOREMAN_INFERENCES || "{}") as Record<string, string>;
  const adapter = lines[inference.adapter] ?? `npx -y @opensoftware/inference-${inference.adapter}`;
  return startGateway(adapter.split(" "), resolve(folder, inference.config), env);
}
