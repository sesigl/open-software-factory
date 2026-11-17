// foreman serve: the run API on PORT and a Temporal worker that runs the factory's workflow (ADR 0067). With
// FOREMAN_NATS_URL it also starts runs for work.received@v1, runs a run again for work.retry-requested@v1, passes gate.decided@v1 to the waiting runs and keeps the IDs of doctor.ping@v1 (ADR 0120). A factory
// with an inference adapter gets its gateway while the server runs (ADR 0070). With FOREMAN_PERSON_KEYS a signal or a
// retry that names a person needs the person's proof (ADR 0151). It runs until SIGTERM or SIGINT.
import { timingSafeEqual } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Health, healthOf, testHook, UsageError } from "@opensoftware/cli";
import type { GateDecided, WorkItem, WorkRetryRequested } from "@opensoftware/contracts";
import { type Actor, type PersonChecker, personChecker } from "@opensoftware/person-proof";
import { Client, Connection, WorkflowNotFoundError } from "@temporalio/client";
import { NativeConnection, Worker } from "@temporalio/worker";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { FactoryNotReadable, FactoryUnreachable, factorySource } from "../adapters/factory.ts";
import { gatekeeper } from "../adapters/gatekeeper.ts";
import { type Attached, attachGateway, startGateway } from "../adapters/inference.ts";
import { type Bus, openBus, SUBJECTS } from "../adapters/nats.ts";
import { exporterOf } from "../adapters/otlp.ts";
import { removeLeftovers } from "../adapters/sandbox.ts";
import { adaptersOf, type CommandLines, commandOf, MAP_OF, PORTS, type Port } from "../domain/adapters.ts";
import type { Definition } from "../domain/definition.ts";
import { isoNow } from "../domain/time.ts";
import { activities } from "../workflows/activities.ts";
import { Conflict, type Runs, runs } from "./runs.ts";

export type Env = Record<string, string | undefined>;

const SECONDS_OF = { d: 86_400, h: 3_600, m: 60, s: 1 } as const;

/** OSF_STREAM_MAX_AGE, like "7d", "12h", "30m" or "90s", in milliseconds; undefined when it is unset (ADR 0116). */
export function streamMaxAge(env: Env): number | undefined {
  const text = env.OSF_STREAM_MAX_AGE;
  if (!text) return undefined;
  const match = text.match(/^([1-9][0-9]*)([dhms])$/);
  if (!match) throw new UsageError(`OSF_STREAM_MAX_AGE is "${text}": set a duration like 7d, 12h, 30m or 90s`);
  return Number(match[1]) * SECONDS_OF[match[2] as keyof typeof SECONDS_OF] * 1000;
}

/** The setting as a whole number of 1 or more; undefined when it is unset. Another value stops the server. */
export function wholeOf(env: Env, name: string): number | undefined {
  const text = env[name];
  if (!text) return undefined;
  if (!/^[1-9][0-9]*$/.test(text)) throw new UsageError(`${name} is "${text}": set a whole number of 1 or more`);
  return Number(text);
}

const BUNDLE = fileURLToPath(new URL("../workflows.bundle.js", import.meta.url));

const problem = (reply: FastifyReply, status: number, title: string, detail: string) =>
  reply.code(status).type("application/problem+json").send({ title, status, detail });

/** The title of each refusal of a person proof (ADR 0151). */
const REFUSED = {
  401: "Unauthorized",
  403: "The person proof does not fit the request",
  503: "The person proof cannot be checked",
} as const;

/**
 * The checker of FOREMAN_PERSON_KEYS (ADR 0151); without the setting none, and a warning that the API token names any
 * person. A malformed setting stops the server.
 */
function checkerOf(env: Env, warn: (text: string) => void, now: () => string): PersonChecker | undefined {
  const setting = env.FOREMAN_PERSON_KEYS;
  if (!setting) {
    warn("FOREMAN_PERSON_KEYS is not set: a caller with FOREMAN_API_TOKEN acts as any person it names (ADR 0151)");
    return undefined;
  }
  try {
    return personChecker(setting, { audience: "foreman", now: () => new Date(now()) });
  } catch (error) {
    throw new UsageError(`FOREMAN_PERSON_KEYS: ${(error as Error).message}`);
  }
}

/** Whether the request carries the token; compared in constant time. */
function authorized(header: string | undefined, token: string): boolean {
  const [sent, wanted] = [Buffer.from(header ?? ""), Buffer.from(`Bearer ${token}`)];
  return sent.length === wanted.length && timingSafeEqual(sent, wanted);
}

/** The doctor's pings the consumer received since the server started, by ID, with when (ADR 0120). */
type Pings = Map<string, string>;
/** The server keeps the newest pings only, so pings cannot fill its memory. */
const KEPT_PINGS = 100;

interface Api {
  work: Runs;
  token: string;
  pings: Pings;
  health: () => Promise<Health>;
  /** The checker of FOREMAN_PERSON_KEYS, when it is set (ADR 0151). */
  persons: PersonChecker | undefined;
  warn: (text: string) => void;
}

function api({ work, token, pings, health, persons, warn }: Api) {
  const app = Fastify();
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (error instanceof FactoryUnreachable)
      return problem(reply, 503, "The factory cannot be read now", error.message);
    if (error instanceof UsageError) return problem(reply, 400, "Bad request", error.message);
    if (error instanceof Conflict) return problem(reply, 409, error.title, error.message);
    return problem(reply, error.statusCode ?? 500, "The request failed", error.message);
  });
  // A person proof covers the body's bytes as they arrived, so the parser keeps them beside the parsed body.
  const bodies = new WeakMap<FastifyRequest, Buffer>();
  // Stryker disable next-line StringLiteral: Fastify's own defaults; no scenario sends a body with "__proto__"
  const json = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    bodies.set(request, body as Buffer);
    json(request, body.toString(), done);
  });
  /**
   * With FOREMAN_PERSON_KEYS, a body whose `by` names a person needs the proof of that person; the body then names the
   * person the proof names. A refusal is logged with the person the body claims, never with the proof (ADR 0151).
   */
  const proven = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { by?: Actor } | null;
    const by = body?.by;
    // A body without a person is the domain's to check.
    if (!persons || typeof by?.id !== "string") return;
    const { method, url } = request;
    const check = await persons.check({
      headers: request.headers,
      method,
      path: url,
      body: bodies.get(request) as Buffer,
      actor: by,
    });
    if (check.ok) {
      request.body = { ...body, by: check.actor };
      return;
    }
    warn(`refused ${method} ${url} of "${check.sub}": ${check.reason}`);
    return problem(reply, check.status, REFUSED[check.status], check.reason);
  };
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
  app.get<{ Querystring: { state?: string; limit?: string; cursor?: string } }>("/v1/runs", async (request) =>
    work.list(request.query),
  );
  app.get<{ Params: { runId: string } }>("/v1/runs/:runId", async (request, reply) => {
    const view = await work.shown(request.params.runId);
    return view ?? unknown(reply, request.params.runId);
  });
  // A signal and a retry are the actions of a person on a run; POST /v1/runs starts work and needs no proof (ADR 0151).
  app.post<{ Params: { runId: string } }>("/v1/runs/:runId/signals", { preHandler: proven }, async (request, reply) => {
    const view = await work.signal(request.params.runId, request.body);
    return view ? reply.code(202).send(view) : unknown(reply, request.params.runId);
  });
  app.post<{ Params: { runId: string } }>("/v1/runs/:runId/retry", { preHandler: proven }, async (request, reply) => {
    const view = await work.retry(request.params.runId, request.body);
    return view ? reply.code(201).send(view) : unknown(reply, request.params.runId);
  });
  app.get<{ Params: { id: string } }>("/v1/doctor/pings/:id", async (request, reply) => {
    const { id } = request.params;
    const receivedAt = pings.get(id);
    return receivedAt
      ? { id, receivedAt }
      : problem(reply, 404, "No such ping", `the server has received no doctor.ping@v1 ${id}`);
  });
  return app;
}

/**
 * Starts runs for work items from intake, runs a run again when intake asks (ADR 0105), hands gate decisions to the
 * runs that wait for them and keeps when each doctor's ping came (ADR 0120), through the durable consumer "foreman"
 * (ADR 0085). An event that can never succeed, a work
 * item that is not valid, a decision for a run that does not exist, or a retry of a run that cannot run again, is a
 * warning and is acknowledged; another failure comes again, also a factory that cannot be read now.
 */
function listen(bus: Bus, work: Runs, pings: Pings, now: () => string, warn: (text: string) => void): Promise<void> {
  const subjects = [SUBJECTS.workReceived, SUBJECTS.workRetryRequested, SUBJECTS.gateDecided, SUBJECTS.doctorPing];
  return bus.consume("foreman", subjects, async (event, subject) => {
    const { data, id } = event as { data?: unknown; id?: unknown };
    try {
      if (subject === SUBJECTS.doctorPing) {
        pings.set(String(id), now());
        // Stryker disable next-line all: a scenario would need 101 pings to see the oldest go
        for (const old of [...pings.keys()].slice(0, -KEPT_PINGS)) pings.delete(old);
      } else if (subject === SUBJECTS.gateDecided) {
        const { workItemId, gateId, decision } = data as GateDecided["data"];
        await work.decided(workItemId, { gateId, state: decision });
      } else if (subject === SUBJECTS.workRetryRequested) {
        const { runId, requester } = data as WorkRetryRequested["data"];
        if (!(await work.retry(runId, { by: requester }))) warn(`${subject}: the server has no run ${runId}`);
      } else await work.start(data as WorkItem);
    } catch (failure) {
      // The factory may be readable at the next delivery, so the event comes again; it is not the event's fault.
      if (failure instanceof FactoryNotReadable) throw failure;
      if (!(failure instanceof UsageError || failure instanceof WorkflowNotFoundError || failure instanceof Conflict))
        throw failure;
      warn(`${subject}: ${failure.message}`);
    }
  });
}

export async function serve(env: Env) {
  const token = env.FOREMAN_API_TOKEN;
  if (!token) throw new UsageError("set FOREMAN_API_TOKEN: the token that callers of the API send");
  // The test clock, before the server reads or starts anything (ADR 0166).
  const fixed = testHook(env, "OSF_NOW");
  const now = () => isoNow(fixed);
  // The numbers of the settings, before the server reads or starts anything.
  const pollMs = wholeOf(env, "FOREMAN_POLL_MS") ?? 1000;
  const retryMs = wholeOf(env, "FOREMAN_INFERENCE_RETRY_MS") ?? 1000;
  const heartbeatMs = wholeOf(env, "FOREMAN_HEARTBEAT_TIMEOUT_MS") ?? 60_000;
  const waits = {
    checkPollMs: wholeOf(env, "FOREMAN_CHECK_POLL_MS") ?? 30_000,
    checkTimeoutMs: wholeOf(env, "FOREMAN_CHECK_TIMEOUT_MS") ?? 7_200_000,
    gateTimeoutMs: wholeOf(env, "FOREMAN_GATE_TIMEOUT_MS") ?? 604_800_000,
  };
  // Unset, the stages run side by side without a limit, as before (ADR 0160).
  const maxStages = wholeOf(env, "FOREMAN_MAX_STAGES");
  const warn = (text: string) => process.stderr.write(`foreman: ${text}\n`);
  const persons = checkerOf(env, warn, now);
  const data = resolve(env.OSF_DATA || ".foreman");
  // With FOREMAN_REQUIRE_SANDBOX a factory whose agent has no sandbox cannot run: the server, a run and a retry refuse it.
  const source = factorySource(env.FOREMAN_FACTORY || "factory.yaml", data, env.FOREMAN_FACTORY_TOKEN, {
    requireSandbox: env.FOREMAN_REQUIRE_SANDBOX === "true",
  });
  const { definition } = await source.read();
  const maps = Object.fromEntries(
    PORTS.map((port) => [port, JSON.parse(env[MAP_OF[port]] || "{}") as CommandLines]),
  ) as Record<Port, CommandLines>;
  const address = env.FOREMAN_TEMPORAL_ADDRESS || "localhost:7233";
  // Unset, the client and the worker use the namespace "default".
  const namespace = env.FOREMAN_TEMPORAL_NAMESPACE;
  const taskQueue = env.FOREMAN_TASK_QUEUE || "foreman";
  const stageQueue = `${taskQueue}-stages`;
  const bus = env.FOREMAN_NATS_URL ? await openBus(env.FOREMAN_NATS_URL, warn, streamMaxAge(env)) : undefined;
  const traces = exporterOf(env);

  // The gateway starts in the background, so the server does not wait for it (ADR 0099).
  const gatewayFolder = join(data, "inference");
  const gateway = gatewayOf(definition, maps.inference, source.folder(), gatewayFolder, env, retryMs, warn);
  const sandbox = env.FOREMAN_SANDBOX || "docker";
  const owner = env.FOREMAN_SANDBOX_OWNER || undefined;
  // The sandboxes that a foreman of this owner left go while the worker loads, before it runs a stage (ADR 0158).
  const leftovers = owner
    ? removeLeftovers(
        commandOf(maps.sandbox, "sandbox", definition.sandboxAdapter ?? sandbox, definition.ranges),
        owner,
        env,
        warn,
      )
    : undefined;
  // A gateway stops with the server, also when the server cannot start.
  try {
    const stopping = new AbortController();
    const acts = activities({
      now,
      bus,
      gatekeeper: gatekeeper(env.FOREMAN_GATEKEEPER_URL, env.FOREMAN_GATEKEEPER_TOKEN),
      harnesses: maps.harness,
      sandboxes: maps.sandbox,
      sandbox,
      ...(owner ? { owner } : {}),
      forges: maps.forge,
      secrets: JSON.parse(env.FOREMAN_SECRETS || "{}") as CommandLines,
      forgeEnv: {
        ...(env.FOREMAN_FORGE_URL ? { FORGE_URL: env.FOREMAN_FORGE_URL } : {}),
        ...(env.FOREMAN_FORGE_TOKEN ? { FORGE_TOKEN: env.FOREMAN_FORGE_TOKEN } : {}),
      },
      waits,
      data,
      pollMs,
      control: (runId) => work.control(runId),
      ...(gateway ? { gateway: gateway.gateway, gatewayFolder } : {}),
      ...(traces ? { traces } : {}),
      warn,
      env,
    });
    const options = {
      namespace,
      maxHeartbeatThrottleInterval: pollMs,
      defaultHeartbeatThrottleInterval: pollMs,
      // At SIGTERM a short activity may end; after this time the worker cancels the running stages (ADR 0101).
      shutdownGraceTime: "1 second",
    } as const;
    // The worker loads the workflow bundle, the longest step of the start, while the client connects (ADR 0067). The
    // runs' workflows and their short activities run on `taskQueue`, the stages that run an agent on `stageQueue`,
    // whose worker takes at most FOREMAN_MAX_STAGES at once: a stage waits there, and no wait for a gate or the checks
    // waits behind it (ADR 0160). A run that started before the queue of the stages runs its stages on `taskQueue`.
    const loading = NativeConnection.connect({ address }).then((connection) =>
      Promise.all([
        Worker.create({ ...options, connection, taskQueue, workflowBundle: { codePath: BUNDLE }, activities: acts }),
        Worker.create({
          ...options,
          connection,
          taskQueue: stageQueue,
          activities: { runStage: acts.runStage },
          ...(maxStages ? { maxConcurrentActivityTaskExecutions: maxStages } : {}),
        }),
      ]),
    );
    const [temporal, [worker, stager]] = await Promise.all([Connection.connect({ address }), loading]);
    const client = new Client({ connection: temporal, namespace });
    // Each run names its adapters and the versions it asks for (ADR 0110).
    const factory = async () => {
      const read = await source.read();
      return { ...read, definition: { ...read.definition, adapters: adaptersOf(read.definition.ranges, maps) } };
    };
    const work = runs({ client, taskQueue, stageQueue, factory, now, heartbeatMs, stopping: stopping.signal });
    await leftovers;
    const running = both(worker, stager);
    const pings: Pings = new Map();

    const health = () =>
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
                // The check also fails while dead letters wait (ADR 0116).
                check: async () => {
                  await bus.ping();
                  const dead = await bus.deadLetters("foreman");
                  if (dead > 0)
                    throw new Error(
                      `${dead} events failed 5 times and wait on osf.dead.foreman.>; fix the cause the warnings name, then run "foreman resend"`,
                    );
                },
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
      ]);
    const app = api({ work, token, pings, health, persons, warn });
    /** Stops what runs once the worker stopped: the open queries, the API, NATS and Temporal's client. */
    const close = async () => {
      stopping.abort();
      await app.close();
      await bus?.close();
      await temporal.close();
    };

    const port = Number(env.PORT || 8080);
    try {
      if (bus) await listen(bus, work, pings, now, warn);
      await app.listen({ port, host: "0.0.0.0" });
    } catch (error) {
      // A server that cannot start, like one whose port is taken, stops what started, so the process ends.
      worker.shutdown();
      await running.catch(() => undefined);
      await close();
      throw error;
    }
    process.stdout.write(`foreman serves the run API on port ${port}, task queue ${taskQueue} at ${address}\n`);
    // Temporal's runtime stops the worker on SIGTERM and SIGINT; the server stops with it.
    await running;
    await close();
  } finally {
    await gateway?.stop();
  }
  return { lines: [] };
}

/** Runs the workers until each stopped; when one stops, also by a failure, the others stop too, so the process ends. */
async function both(...workers: Worker[]): Promise<void> {
  const stop = () => {
    for (const worker of workers) if (worker.getState() === "RUNNING") worker.shutdown();
  };
  const ends = await Promise.allSettled(workers.map((worker) => worker.run().finally(stop)));
  const failed = ends.find((end) => end.status === "rejected");
  if (failed) throw failed.reason;
}

/** The gateway of the factory's inference adapter from its config, a path relative to the factory's folder. */
function gatewayOf(
  { inference, ranges }: Definition,
  lines: CommandLines,
  folder: string,
  gatewayFolder: string,
  env: Env,
  retryMs: number,
  warn: (text: string) => void,
): Attached | undefined {
  if (!inference) return undefined;
  const adapter = commandOf(lines, "inference", inference.adapter, ranges);
  return attachGateway(
    () => startGateway(adapter, resolve(folder, inference.config), env, gatewayFolder),
    retryMs,
    warn,
  );
}
