// Shared setup of the foreman scenarios: the README's factory and work item, Temporal, the scripted harness behind the
// built harness-acp adapter, a fake sandbox adapter, a fake inference adapter, a scripted gatekeeper, the fake GitHub
// with the built forge-github adapter, and the server with its token.
import type { paths, RunView, WorkItem } from "@opensoftware/contracts";
import type { Fakes, HarnessTurn, InferenceOptions, SandboxOptions, Sut } from "@opensoftware/testkit";

export const API_TOKEN = "testkit-api-token";
export const AUTH = { authorization: `Bearer ${API_TOKEN}` };
export const GATE = "g0a1b2c3d4e5f6a7b";
export const PLAN = "Write a plan";
export const IMPLEMENT = "Implement plan.md";
export const SHIP = "Merge the pull request";
export const TITLE = "Export reports as CSV";
/** How long a scenario waits for a run or an event; a run takes seconds, a busy runner (a mutation run) longer. */
export const WAIT_MS = 45_000;

/** The fenced blocks of the README that name a file, like ```json work.json. */
export function readmeFiles(fakes: Fakes): Record<string, string> {
  const readme = fakes.fromRepository("modules/foreman")["README.md"] as string;
  const files: Record<string, string> = {};
  for (const block of readme.matchAll(/^```\w+ (\S+)\n([\s\S]*?)^```$/gm))
    files[block[1] as string] = block[2] as string;
  return files;
}

export const readmeWork = (fakes: Fakes): WorkItem => JSON.parse(readmeFiles(fakes)["work.json"] as string);

/** A second work item, besides the README's. */
export const otherWork = (fakes: Fakes): WorkItem => ({
  ...readmeWork(fakes),
  id: "wi_0a1b2c3d4e5f60718293",
  title: "Import reports from CSV",
  dedupeKey: "idea:import-csv",
});

/** The README's factory with a gate before the stage "implement". */
export const gatedFactory = (fakes: Fakes): string =>
  (readmeFiles(fakes)["factory.yaml"] as string).replace(
    "  - stage: implement\n",
    "  - stage: implement\n    gate:\n      policy: ./policies/implement.rego\n      approvers: [maintainers]\n",
  );

/** The README's factory whose agents run in sandboxes. */
export const sandboxedFactory = (fakes: Fakes): string => readmeFiles(fakes)["sandboxed/factory.yaml"] as string;

/** The README's factory with the LiteLLM gateway. */
export const gatewayFactory = (fakes: Fakes): string => readmeFiles(fakes)["gateway/factory.yaml"] as string;

/** "foreman serve" on the README's "gateway/factory.yaml", or this text of it, with a fake inference adapter. */
export const servingGateway = (sut: Sut, fakes: Fakes, setup: Setup = {}) =>
  serving(sut, fakes, { factory: gatewayFactory(fakes), inference: {}, ...setup });

/** The harness sessions in the order the agent opened them. */
export type Sessions = ReturnType<Awaited<ReturnType<typeof serving>>["harness"]["sessions"]>;

/** Turns that end at once, for the prompts of both stages. */
export const endingTurns: HarnessTurn[] = [
  { when: PLAN, reply: "plan.md is written" },
  { when: IMPLEMENT, reply: "done" },
];

export interface Setup {
  /** The harness turns; default: both stages end their turn at once. */
  turns?: HarnessTurn[];
  /** The text of factory.yaml; default: the README's. */
  factory?: string;
  /** A scripted gatekeeper that answers each request with GATE in the state "pending". */
  gatekeeper?: boolean;
  /** NATS for the events. */
  nats?: boolean;
  /** A fake sandbox adapter, in FOREMAN_SANDBOXES under the name `sandboxAs`. */
  sandbox?: SandboxOptions;
  /** The name of the fake sandbox adapter; default "docker". */
  sandboxAs?: string;
  /** A fake inference adapter, in FOREMAN_INFERENCES under the name "litellm". */
  inference?: InferenceOptions;
  env?: Record<string, string>;
}

/** Commits the README's factory, or this text of factory.yaml with the README's prompts; returns the commit. */
export async function committed(sut: Sut, fakes: Fakes, factory?: string): Promise<string> {
  const files = readmeFiles(fakes);
  for (const name of [
    "factory.yaml",
    "agents/plan.md",
    "agents/implement.md",
    "agents/implement-pr.md",
    "agents/ship.md",
    "inference/litellm.yaml",
  ])
    await sut.files.put(`$INPUT/${name}`, files[name] as string);
  if (factory) await sut.files.put("$INPUT/factory.yaml", factory);
  return sut.git.commit("the hello factory");
}

/** Commits the factory, starts Temporal and "foreman serve" with the scripted harness. */
export async function serving(sut: Sut, fakes: Fakes, setup: Setup = {}) {
  return servingCommit(sut, fakes, await committed(sut, fakes, setup.factory), setup);
}

/** Starts Temporal and "foreman serve" with the scripted harness on the committed factory. */
export async function servingCommit(sut: Sut, fakes: Fakes, commit: string, setup: Setup = {}) {
  const temporal = await fakes.temporal();
  const harness = await fakes.harness(setup.turns ?? endingTurns);
  const gatekeeper = setup.gatekeeper
    ? await fakes.http([
        {
          method: "POST",
          path: "/v1/gates",
          status: 201,
          body: { id: GATE, state: "pending", workItem: "", stage: "implement", summary: "", approvers: [] },
        },
      ])
    : undefined;
  const nats = setup.nats ? await fakes.nats() : undefined;
  const sandbox = setup.sandbox ? await fakes.sandbox(setup.sandbox) : undefined;
  const inference = setup.inference ? await fakes.inference(setup.inference) : undefined;
  const env = {
    FOREMAN_API_TOKEN: API_TOKEN,
    FOREMAN_TEMPORAL_ADDRESS: temporal.address,
    FOREMAN_HARNESSES: JSON.stringify({
      acp: [sut.adapter("harness/acp"), "run", "--", harness.command, ...harness.args].join(" "),
    }),
    FOREMAN_POLL_MS: "100",
    ...(gatekeeper ? { FOREMAN_GATEKEEPER_URL: gatekeeper.url, FOREMAN_GATEKEEPER_TOKEN: "gatekeeper-token" } : {}),
    ...(nats ? { FOREMAN_NATS_URL: nats.url } : {}),
    ...(sandbox
      ? {
          FOREMAN_SANDBOXES: JSON.stringify({
            [setup.sandboxAs ?? "docker"]: [sandbox.command, ...sandbox.args].join(" "),
          }),
        }
      : {}),
    ...(inference
      ? { FOREMAN_INFERENCES: JSON.stringify({ litellm: [inference.command, ...inference.args].join(" ") }) }
      : {}),
    ...setup.env,
  };
  await sut.http.start(["serve"], { env });
  const api = () => sut.http.client<paths>();
  const server = {
    commit,
    harness,
    gatekeeper,
    nats,
    sandbox,
    inference,
    api,
    start: (work: unknown, headers: Record<string, string> = AUTH) =>
      api().POST("/v1/runs", { body: work as WorkItem, headers }),
    view: async (runId: string) =>
      (await api().GET("/v1/runs/{runId}", { params: { path: { runId } }, headers: AUTH })).data as RunView,
    /** The answer of GET /v1/runs, with `?state=` when a state is given. */
    list: (state?: string) =>
      api().GET("/v1/runs", {
        params: { query: state ? { state: state as RunView["state"] } : {} },
        headers: AUTH,
      }),
    signal: (runId: string, body: unknown) =>
      api().POST("/v1/runs/{runId}/signals", {
        params: { path: { runId } },
        body: body as { type: "cancel" },
        headers: AUTH,
      }),
    /** Reads the run until it is in the state, and returns that view. */
    async until(runId: string, state: RunView["state"], timeoutMs = WAIT_MS): Promise<RunView> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const view = await server.view(runId);
        if (view?.state === state) return view;
        if (Date.now() > deadline)
          throw new Error(`run ${runId} is not ${state} after ${timeoutMs} ms: ${JSON.stringify(view)}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    },
    /** Reads the run until its stage at `index` is in the state. */
    async untilStage(runId: string, index: number, state: string, timeoutMs = WAIT_MS): Promise<RunView> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const view = await server.view(runId);
        if (view?.stages[index]?.state === state) return view;
        if (Date.now() > deadline)
          throw new Error(`stage ${index} of ${runId} is not ${state} after ${timeoutMs} ms: ${JSON.stringify(view)}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    },
    /** Stops the server and starts it again with the same data folder and variables. */
    async restart() {
      await sut.http.stop();
      await sut.http.start(["serve"], { env });
    },
    /** The prompts the scripted agent received that contain the text. */
    prompts: (text: string) => harness.prompts().filter((prompt) => prompt.includes(text)),
  };
  return server;
}

/** The server runs the README's work item; returns the run's ID. */
export async function started(sut: Sut, fakes: Fakes, setup: Setup = {}) {
  const server = await serving(sut, fakes, setup);
  const { data, response } = await server.start(readmeWork(fakes));
  if (response.status !== 201 || !data) throw new Error(`POST /v1/runs answered ${response.status}`);
  return { ...server, runId: data.runId };
}

/** A run of the README's factory that waits at the gate GATE before "implement", with NATS. */
export async function waitingAtGate(sut: Sut, fakes: Fakes, setup: Setup = {}) {
  const run = await started(sut, fakes, { factory: gatedFactory(fakes), gatekeeper: true, nats: true, ...setup });
  await run.until(run.runId, "blocked");
  const events = await sut.events.watch(run.nats as NonNullable<typeof run.nats>);
  /** Publishes gate.decided@v1 for the gate, as gatekeeper does. */
  const decide = (decision: "approved" | "rejected", gateId = GATE) =>
    events.publish("osf.gate.decided.v1", {
      specversion: "1.0",
      id: `${gateId}.decided`,
      source: "/osf/gatekeeper",
      type: "gate.decided@v1",
      time: "2026-01-01T00:00:00Z",
      subject: gateId,
      data: {
        gateId,
        workItemId: readmeWork(fakes).id,
        decision,
        decidedBy: { kind: "person", id: "slack:U0ADA" },
        decidedAt: "2026-01-01T00:00:00Z",
      },
    });
  return { ...run, events, decide };
}

export interface ChecksSetup {
  /** The state of the check "verify" of the pull request; none: the pull request has no check. */
  check?: "pending" | "success" | "failure";
  /** Whether the "implement" turn replies with the pull request's link; default true. */
  linked?: boolean;
  nats?: boolean;
}

/**
 * "foreman serve" on the README's "checks/factory.yaml", with the fake GitHub, whose repository "tester/web" has the
 * pull request 1, and the built forge-github adapter.
 */
export async function servingChecks(sut: Sut, fakes: Fakes, setup: ChecksSetup = {}) {
  const github = await fakes.github();
  await github.createRepository("web", { "README.md": "# web\n" });
  const pr = await github.openPullRequest("web", {
    branch: "export-csv",
    title: TITLE,
    files: { "export.ts": "export const csv = true;\n" },
  });
  /** Sets the check "verify" of the pull request's head commit, as CI does. */
  const check = async (state: string) => {
    const response = await fetch(`${github.url}/repos/${github.owner}/web/statuses/${pr.sha}`, {
      method: "POST",
      headers: { authorization: `token ${github.token}`, "content-type": "application/json" },
      body: JSON.stringify({ state, context: "verify" }),
    });
    if (response.status !== 201) throw new Error(`the fake GitHub answered ${response.status} to the check`);
  };
  if (setup.check) await check(setup.check);
  const server = await serving(sut, fakes, {
    factory: readmeFiles(fakes)["checks/factory.yaml"] as string,
    turns: [
      { when: PLAN, reply: "plan.md is written" },
      { when: IMPLEMENT, reply: setup.linked === false ? "done" : `Opened ${pr.url} for review.` },
      { when: SHIP, reply: "merged" },
    ],
    nats: setup.nats,
    env: {
      FOREMAN_FORGES: JSON.stringify({ github: sut.adapter("forge/github") }),
      FOREMAN_FORGE_URL: github.url,
      FOREMAN_FORGE_TOKEN: github.token,
      FOREMAN_CHECK_POLL_MS: "100",
    },
  });
  return { ...server, github, pr, check };
}

/** A run of the README's "checks/factory.yaml" that waits for the pending check "verify"; returns the run's ID too. */
export async function waitingForCheck(sut: Sut, fakes: Fakes) {
  const server = await servingChecks(sut, fakes, { check: "pending" });
  const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  await server.untilStage(runId, 2, "blocked");
  return { ...server, runId };
}
