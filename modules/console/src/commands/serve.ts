// console serve: the read-only web view of the factory (ADR 0072). Each page asks the foremen, intake and gatekeeper
// when it is opened, and keeps nothing. It runs until SIGTERM or SIGINT.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { UsageError } from "@opensoftware/cli";
import type {
  GateView,
  RunList,
  RunRetry,
  RunView,
  WorkItemList,
  WorkItemView,
  WorkRequest,
} from "@opensoftware/contracts";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { type Api, getJson, postJson } from "../adapters/apis.ts";
import { readFactory } from "../adapters/factory-file.ts";
import { proposals } from "../adapters/forge.ts";
import { cursorsOf, fill, isState, list, namedLinks, nextPageOf, orderRuns, queryOf, STATES } from "../domain/runs.ts";
import { submissionOf } from "../domain/submit.ts";
import { agentPage, factoryPage, type Source } from "../pages/factory.ts";
import { healthPage } from "../pages/health.ts";
import { type Frame, page, problem } from "../pages/html.ts";
import { inboxPage } from "../pages/inbox.ts";
import { runPage } from "../pages/run.ts";
import { runsPage } from "../pages/runs.ts";
import { workPage } from "../pages/work.ts";
import { examine } from "./doctor.ts";

type Env = Record<string, string | undefined>;

const PICO = readFileSync(createRequire(import.meta.url).resolve("@picocss/pico/css/pico.min.css"));

/** Each foreman of CONSOLE_FOREMAN_URL with its token: the one at the same place, else the first. */
function foremen(env: Env): Api[] {
  const urls = list(env.CONSOLE_FOREMAN_URL);
  if (urls.length === 0) throw new UsageError("set CONSOLE_FOREMAN_URL: the base URL of the foreman's API");
  const tokens = list(env.CONSOLE_FOREMAN_TOKEN);
  return urls.map((url, index) => ({ name: "foreman", url, token: tokens[index] ?? tokens[0] }));
}

const optionalApi = (name: string, url: string | undefined, token: string | undefined): Api | undefined =>
  url ? { name, url, token } : undefined;

export async function serve(env: Env) {
  const sources = foremen(env);
  const intake = optionalApi("intake", env.CONSOLE_INTAKE_URL, env.CONSOLE_INTAKE_TOKEN);
  const gatekeeper = optionalApi("gatekeeper", env.CONSOLE_GATEKEEPER_URL, env.CONSOLE_GATEKEEPER_TOKEN);
  const now = () => (env.OSF_NOW ? Date.parse(env.OSF_NOW) : Date.now());
  const links = namedLinks(env.CONSOLE_LINKS);
  const refresh = Number(env.CONSOLE_REFRESH || 10);
  const factoryFile = env.CONSOLE_FACTORY || "factory.yaml";
  const path = env.CONSOLE_FACTORY_PATH || "factory.yaml";
  const branch = env.CONSOLE_BRANCH || "main";
  const repository = env.CONSOLE_REPOSITORY_URL?.replace(/\/$/, "");
  const source: Source = { path, branch, url: repository && `${repository}/blob/${branch}/${path}` };
  const inbox = env.CONSOLE_INBOX_REPOSITORY;
  const userHeader = env.CONSOLE_USER_HEADER?.toLowerCase() || undefined;
  const actions = Boolean(userHeader);
  const prefix = env.CONSOLE_INBOX_PREFIX || "observer/";
  const forge = {
    command: env.CONSOLE_FORGE_ADAPTER || "npx -y @opensoftware/forge-github",
    url: env.CONSOLE_FORGE_URL || undefined,
    token: env.CONSOLE_FORGE_TOKEN,
  };

  const send = (
    reply: FastifyReply,
    status: number,
    frame: Omit<Frame, "links" | "inbox" | "work">,
    content: Parameters<typeof page>[1],
  ) =>
    reply
      .code(status)
      .type("text/html; charset=utf-8")
      .send(page({ ...frame, links, inbox: Boolean(inbox), work: Boolean(intake) }, content));

  const app = Fastify({ logger: false });
  app.get("/pico.css", (_request, reply) => reply.type("text/css").send(PICO));

  app.get<{ Querystring: { state?: string; page?: string } }>("/", async (request, reply) => {
    const { state, page: at } = request.query;
    if (state !== undefined && !isState(state))
      return send(
        reply,
        400,
        { title: "Runs" },
        problem("No such state", `no state ${state}: ${STATES.slice(0, -1).join(", ")} or ${STATES.at(-1)}`),
      );
    const cursors = cursorsOf(at, sources.length);
    if (!cursors) return send(reply, 400, { title: "Runs" }, problem("No such page", `no page ${at} of the runs`));
    // Each foreman answers one page of its runs; one whose runs ended on an earlier page is not asked (ADR 0115).
    const answers = await Promise.all(
      sources.map((api, index) => {
        const cursor = cursors[index];
        return cursor === null ? undefined : getJson<RunList>(api, `/v1/runs${queryOf({ state, cursor })}`);
      }),
    );
    const runs = orderRuns(answers.flatMap((answer) => (answer?.ok ? answer.body.runs : [])));
    const notes = answers.flatMap((answer) => (answer && !answer.ok ? [answer.note] : []));
    const page = nextPageOf(answers.map((answer) => (answer?.ok && answer.body.next) || null));
    const next = page && `/${queryOf({ state, page })}`;
    return send(reply, 200, { title: "Runs", refresh, notes }, runsPage(runs, state, now(), next));
  });

  /** The run and the foreman that knows it, or the answer 404. */
  const findRun = async (runId: string, reply: FastifyReply) => {
    const answers = await Promise.all(
      sources.map((api) => getJson<RunView>(api, `/v1/runs/${encodeURIComponent(runId)}`)),
    );
    const index = answers.findIndex((answer) => answer.ok);
    const found = answers[index];
    if (!found?.ok) return { missing: send(reply, 404, { title: runId }, problem("Not found", `no run ${runId}`)) };
    return { run: found.body, api: sources[index] as Api };
  };

  app.get<{ Params: { runId: string } }>("/runs/:runId", async (request, reply) => {
    const { runId } = request.params;
    const { run, missing } = await findRun(runId, reply);
    if (!run) return missing;
    const workItem = intake ? await getJson<WorkItemView>(intake, `/v1/work-items/${run.workItem.id}`) : undefined;
    const own: WorkRequest = {
      requester: run.workItem.requester,
      origin: run.workItem.origin,
      receivedAt: run.startedAt,
    };
    const requests = workItem?.ok ? workItem.body.requests : [own];
    const gates = new Map<string, GateView>();
    for (const gateId of run.stages.flatMap((stage) => stage.gateId ?? [])) {
      const gate = gatekeeper && (await getJson<GateView>(gatekeeper, `/v1/gates/${gateId}`));
      if (gate?.ok) gates.set(gateId, gate.body);
    }
    const temporal = env.CONSOLE_TEMPORAL_URL?.replace(/\/$/, "");
    const namespace = env.CONSOLE_TEMPORAL_NAMESPACE || "default";
    const runLinks = {
      // {traceId} needs a foreman that names the run's trace (ADR 0087); without it the page has no trace link.
      trace:
        env.CONSOLE_TRACE_URL && (run.traceId || !env.CONSOLE_TRACE_URL.includes("{traceId}"))
          ? fill(env.CONSOLE_TRACE_URL, { runId, ...(run.traceId ? { traceId: run.traceId } : {}) })
          : undefined,
      history: temporal && `${temporal}/namespaces/${namespace}/workflows/${runId}`,
      transcript: (sessionId: string) => env.CONSOLE_SESSION_URL && fill(env.CONSOLE_SESSION_URL, { sessionId }),
    };
    return send(
      reply,
      200,
      { title: run.workItem.title, refresh },
      runPage(run, requests, gates, runLinks, now(), actions),
    );
  });

  app.get("/factory", async (_request, reply) => {
    const factory = readFactory(factoryFile);
    return send(reply, 200, { title: "Factory" }, factoryPage(factory, source));
  });

  app.get<{ Params: { name: string } }>("/factory/agents/:name", async (request, reply) => {
    const { name } = request.params;
    const agent = readFactory(factoryFile).agents?.[name];
    if (!agent) return send(reply, 404, { title: name }, problem("Not found", `no agent ${name} in ${path}`));
    return send(reply, 200, { title: name }, agentPage(name, agent, source));
  });

  app.get("/inbox", async (_request, reply) => {
    if (!inbox)
      return send(
        reply,
        404,
        { title: "Inbox" },
        problem("No inbox", "no inbox: set CONSOLE_INBOX_REPOSITORY to the repository of observer's pull requests"),
      );
    const answer = await proposals(forge, inbox, prefix);
    const notes = answer.ok ? [] : [answer.note];
    return send(reply, 200, { title: "Inbox", notes }, inboxPage(inbox, answer.ok ? answer.body : [], now()));
  });

  app.get<{ Querystring: { cursor?: string } }>("/work", async (request, reply) => {
    if (!intake)
      return send(
        reply,
        404,
        { title: "Work" },
        problem("No work items", "no work items: set CONSOLE_INTAKE_URL to the base URL of intake's API"),
      );
    const answer = await getJson<WorkItemList>(intake, `/v1/inbox${queryOf({ cursor: request.query.cursor })}`);
    const notes = answer.ok ? [] : [answer.note];
    const items = answer.ok ? answer.body.workItems : [];
    // intake's cursor of the next page is the console's (ADR 0115).
    const next = answer.ok && answer.body.next ? `/work${queryOf({ cursor: answer.body.next })}` : undefined;
    return send(reply, 200, { title: "Work", refresh, notes }, workPage(items, now(), actions, next));
  });

  // Actions (ADR 0089): only with CONSOLE_USER_HEADER, from the same origin, in the name of the signed-in person.
  // Forms always parse, so a read-only console answers a form with 405, not 415.
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) =>
    done(null, Object.fromEntries(new URLSearchParams(body as string))),
  );
  /** The signed-in person of a form from the same site, or the answer that refuses it. */
  const signedIn = (request: FastifyRequest, reply: FastifyReply, title: string) => {
    const origin = request.headers.origin;
    if (origin && new URL(origin).host !== request.headers.host)
      return { refused: send(reply, 403, { title }, problem("Forbidden", "the form came from another site")) };
    const person = String(request.headers[userHeader as string] ?? "");
    if (!person)
      return {
        refused: send(reply, 401, { title }, problem("Sign in", `sign in first: the console needs ${userHeader}`)),
      };
    return { person };
  };
  if (userHeader && intake) {
    app.post<{ Body: Record<string, string> }>("/work", async (request, reply) => {
      const { person, refused } = signedIn(request, reply, "Work");
      if (refused) return refused;
      const submission = submissionOf(request.body ?? {}, person, new Date(now()).toISOString());
      const answer = await postJson(intake, "/v1/work-items", submission);
      if (!answer.ok) return send(reply, 502, { title: "Work" }, problem("Not submitted", answer.note));
      return reply.code(303).header("location", "/work").send();
    });
  }
  if (userHeader) {
    app.post<{ Params: { runId: string } }>("/runs/:runId/retry", async (request, reply) => {
      const { runId } = request.params;
      const { person, refused } = signedIn(request, reply, runId);
      if (refused) return refused;
      const { api, missing } = await findRun(runId, reply);
      if (!api) return missing;
      const retry: RunRetry = { by: { kind: "person", id: person } };
      const answer = await postJson<RunView>(api, `/v1/runs/${encodeURIComponent(runId)}/retry`, retry);
      if (answer.ok) return reply.code(303).header("location", `/runs/${answer.body.runId}`).send();
      const detail = answer.detail ?? answer.note;
      return send(reply, answer.status || 502, { title: runId }, problem("Not run again", detail));
    });
  }

  app.get("/health", async (_request, reply) => {
    const items = await examine(env);
    return send(reply, items.every(({ ok }) => ok) ? 200 : 503, { title: "Health" }, healthPage(items));
  });

  // Read-only: any method but GET and HEAD answers 405.
  app.route({
    method: ["POST", "PUT", "PATCH", "DELETE"],
    url: "/*",
    handler: (_request, reply) => reply.code(405).header("allow", "GET, HEAD").send(),
  });

  const port = Number(env.PORT || 8080);
  await app.listen({ port, host: "0.0.0.0" });
  process.stdout.write(`console serves the factory's pages on port ${port}\n`);
  await new Promise<void>((resolve) => {
    process.once("SIGTERM", resolve);
    process.once("SIGINT", resolve);
  });
  await app.close();
  return { lines: [] };
}
