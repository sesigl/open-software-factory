// Shared setup of the foreman scenarios: the README's factory and work item, Temporal, the scripted harness behind the
// built harness-acp adapter, a fake sandbox adapter, a scripted gatekeeper, and the server with its token.
import type { paths, RunView, WorkItem } from "@opensoftware/contracts";
import type { Fakes, HarnessTurn, SandboxOptions, Sut } from "@opensoftware/testkit";

export const API_TOKEN = "testkit-api-token";
export const AUTH = { authorization: `Bearer ${API_TOKEN}` };
export const GATE = "g0a1b2c3d4e5f6a7b";
export const PLAN = "Write a plan";
export const IMPLEMENT = "Implement plan.md";
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

/** The README's factory with a gate before the stage "implement". */
export const gatedFactory = (fakes: Fakes): string =>
  (readmeFiles(fakes)["factory.yaml"] as string).replace(
    "  - stage: implement\n",
    "  - stage: implement\n    gate:\n      policy: ./policies/implement.rego\n      approvers: [maintainers]\n",
  );

/** The README's factory whose agents run in sandboxes. */
export const sandboxedFactory = (fakes: Fakes): string => readmeFiles(fakes)["sandboxed/factory.yaml"] as string;

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
  env?: Record<string, string>;
}

/** Commits the README's factory, or this text of factory.yaml with the README's prompts; returns the commit. */
export async function committed(sut: Sut, fakes: Fakes, factory?: string): Promise<string> {
  const files = readmeFiles(fakes);
  for (const name of ["factory.yaml", "agents/plan.md", "agents/implement.md"])
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
    api,
    start: (work: unknown, headers: Record<string, string> = AUTH) =>
      api().POST("/v1/runs", { body: work as WorkItem, headers }),
    view: async (runId: string) =>
      (await api().GET("/v1/runs/{runId}", { params: { path: { runId } }, headers: AUTH })).data as RunView,
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
