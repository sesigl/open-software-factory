// console serve: the read-only web view of the factory (ADR 0072). Each page asks the foremen, intake and gatekeeper
// when it is opened, and keeps nothing. It runs until SIGTERM or SIGINT.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { UsageError } from "@opensoftware/cli";
import type { GateView, RunView, WorkItemView, WorkRequest } from "@opensoftware/contracts";
import Fastify, { type FastifyReply } from "fastify";
import { type Api, getJson } from "../adapters/apis.ts";
import { readFactory } from "../adapters/factory-file.ts";
import { fill, isState, list, namedLinks, orderRuns, STATES } from "../domain/runs.ts";
import { agentPage, factoryPage, type Source } from "../pages/factory.ts";
import { type Frame, page, problem } from "../pages/html.ts";
import { runPage } from "../pages/run.ts";
import { runsPage } from "../pages/runs.ts";

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

  const send = (
    reply: FastifyReply,
    status: number,
    frame: Omit<Frame, "links">,
    content: Parameters<typeof page>[1],
  ) =>
    reply
      .code(status)
      .type("text/html; charset=utf-8")
      .send(page({ ...frame, links }, content));

  const app = Fastify({ logger: false });
  app.get("/pico.css", (_request, reply) => reply.type("text/css").send(PICO));

  app.get<{ Querystring: { state?: string } }>("/", async (request, reply) => {
    const state = request.query.state;
    if (state !== undefined && !isState(state))
      return send(
        reply,
        400,
        { title: "Runs" },
        problem("No such state", `no state ${state}: ${STATES.slice(0, -1).join(", ")} or ${STATES.at(-1)}`),
      );
    const query = state ? `?state=${state}` : "";
    const answers = await Promise.all(sources.map((api) => getJson<{ runs: RunView[] }>(api, `/v1/runs${query}`)));
    const runs = orderRuns(answers.flatMap((answer) => (answer.ok ? answer.body.runs : [])));
    const notes = answers.flatMap((answer) => (answer.ok ? [] : [answer.note]));
    return send(reply, 200, { title: "Runs", refresh, notes }, runsPage(runs, state, now()));
  });

  app.get<{ Params: { runId: string } }>("/runs/:runId", async (request, reply) => {
    const { runId } = request.params;
    const answers = await Promise.all(
      sources.map((api) => getJson<RunView>(api, `/v1/runs/${encodeURIComponent(runId)}`)),
    );
    const found = answers.find((answer) => answer.ok);
    if (!found?.ok) return send(reply, 404, { title: runId }, problem("Not found", `no run ${runId}`));
    const run = found.body;
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
      trace: env.CONSOLE_TRACE_URL && fill(env.CONSOLE_TRACE_URL, { runId }),
      history: temporal && `${temporal}/namespaces/${namespace}/workflows/${runId}`,
      transcript: (sessionId: string) => env.CONSOLE_SESSION_URL && fill(env.CONSOLE_SESSION_URL, { sessionId }),
    };
    return send(reply, 200, { title: run.workItem.title, refresh }, runPage(run, requests, gates, runLinks, now()));
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
