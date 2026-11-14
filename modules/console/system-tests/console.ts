// Shared setup of the console scenarios: runs as the foreman's API shows them, fake foremen, the server, and readers
// of the pages through sut.pages: their table rows, links and buttons, found by role and name (ADR 0131).
import type { RunView } from "@opensoftware/contracts";
import type { Fakes, Page, Queries, Sut } from "@opensoftware/testkit";

export const RUN = "run_5d41402abc4b2a76b971";
export const SLACK_THREAD = "https://acme.slack.com/archives/C0WORK/p1767225600000001";

/** A run of the factory "web", running since five minutes before the testkit's clock, with these fields changed. */
export function runOf(title: string, fields: Partial<RunView> = {}): RunView {
  return {
    runId: RUN,
    workItem: {
      id: "wi_0123456789abcdef0123",
      type: "task",
      title,
      requester: { kind: "person", id: "slack:U0VARUN", displayName: "Varun" },
      origin: { source: "slack", url: SLACK_THREAD },
      dedupeKey: SLACK_THREAD,
    },
    factory: "web",
    factoryVersion: "0a1b2c3",
    state: "running",
    startedAt: "2025-12-31T23:55:00.000Z",
    stages: [],
    ...fields,
  };
}

/** A foreman's API that lists these runs at /v1/runs and shows each at /v1/runs/<runId>. */
export const foreman = (fakes: Fakes, runs: RunView[], more: Parameters<Fakes["http"]>[0] = []) =>
  fakes.http([
    ...more,
    { path: "/v1/runs", body: { runs } },
    ...runs.map((run) => ({ path: `/v1/runs/${run.runId}`, body: run })),
  ]);

/** Starts "console serve" with the foremen at these URLs and these variables. */
export const serving = (sut: Sut, foremen: string[], env: Record<string, string> = {}) =>
  sut.http.start(["serve"], { env: { CONSOLE_FOREMAN_URL: foremen.join(","), ...env } });

/** The page at the path, opened as a person opens it, with these headers (a sign-in proxy's, for example). */
export const open = (sut: Sut, path: string, headers: Record<string, string> = {}): Promise<Page> =>
  sut.pages.open(path, { headers });

/** The rows of the tables in a page or an element of it that have cells, each as the text of its cells. */
export const rows = (scope: Queries): string[][] =>
  scope
    .queryAllByRole("row")
    .map((row) => row.queryAllByRole("cell").map((cell) => cell.text))
    .filter((cells) => cells.length > 0);

/** The links of a page or of an element of it: their target and their text. */
export const links = (scope: Queries | undefined): { href: string; text: string }[] =>
  (scope?.queryAllByRole("link") ?? []).map((link) => ({ href: link.attribute("href") ?? "", text: link.text }));

/** The table row whose first cell holds this text. */
export const rowWith = (scope: Queries, first: string) =>
  scope.queryAllByRole("row").find((row) => row.queryAllByRole("cell")[0]?.text === first);

/** A factory definition with the agent "triage", as CONSOLE_FACTORY reads it. */
export const FACTORY_YAML = `version: 1
factory: acme
description: The factory of Acme's web shop.
providers:
  harness:
    claude-code: "^2"
agents:
  triage:
    harness: claude-code
    model: routes/triage
    prompt: ./prompts/triage.md
    effort: high
`;

/** Writes the factory definition to $INPUT and gives the variables that name it. */
export async function factoryEnv(sut: Sut): Promise<Record<string, string>> {
  await sut.files.put("$INPUT/factory.yaml", FACTORY_YAML);
  return { CONSOLE_FACTORY: sut.files.path("$INPUT/factory.yaml") };
}

/** The testkit's fake GitHub with the repository "tester/web" and an open pull request per branch, in this order. */
export async function proposalForge(fakes: Fakes, pulls: { branch: string; title: string }[]) {
  const forge = await fakes.github();
  await forge.createRepository("web");
  const opened = [];
  for (const { branch, title } of pulls)
    opened.push(
      await forge.openPullRequest("web", { branch, title, files: { [`${branch.replace(/\W/g, "-")}.md`]: title } }),
    );
  return { forge, opened };
}

/** Starts "console serve" with the inbox of "tester/web" on the fake GitHub through forge-github. */
export async function servingInbox(
  sut: Sut,
  fakes: Fakes,
  forge: Awaited<ReturnType<Fakes["github"]>>,
  env: Record<string, string> = {},
) {
  const api = await foreman(fakes, []);
  await serving(sut, [api.url], {
    CONSOLE_INBOX_REPOSITORY: "tester/web",
    CONSOLE_FORGE_ADAPTER: sut.adapter("forge/github"),
    CONSOLE_FORGE_URL: forge.url,
    CONSOLE_FORGE_TOKEN: forge.token,
    ...env,
  });
}

/** The links of the page's banner, its navigation. */
export const navLinks = (page: Page) => links(page.getByRole("banner"));

/** The answer of a server's /v1/health with these checks: 200 when every check is ok, else 503. */
export const healthRoute = (checks: { name: string; ok: boolean; detail?: string }[]) => {
  const ok = checks.every((check) => check.ok);
  return { path: "/v1/health", status: ok ? 200 : 503, body: { status: ok ? "ok" : "failing", checks } };
};

/** A server's API with its /v1/health, and the route that needs its token answering `tokenStatus`. */
export const healthyServer = (
  fakes: Fakes,
  checks: { name: string; ok: boolean; detail?: string }[],
  tokenRoute: string,
  tokenStatus = 200,
) =>
  fakes.http([
    healthRoute(checks),
    { path: tokenRoute, status: tokenStatus, body: tokenStatus === 200 ? { runs: [] } : { title: "Unauthorized" } },
  ]);

export const TOKEN_ROUTES = {
  foreman: "/v1/runs",
  intake: "/v1/work-items/wi_00000000000000000000",
  gatekeeper: "/v1/gates/g0000000000000000",
} as const;

/** An intake that lists no work items and takes every submission, as intake answers it. */
export const submittingIntake = (fakes: Fakes) =>
  fakes.http([
    { path: "/v1/inbox", body: { workItems: [] } },
    { method: "POST", path: "/v1/work-items", status: 201, body: {} },
  ]);

/** Sends the form "submit work" to the console with these fields and headers, without following a redirect. */
export const sendWorkForm = (sut: Sut, fields: Record<string, string>, headers: Record<string, string> = {}) =>
  sut.pages.send("/work", fields, { headers, follow: false });

export const NEW_RUN = "run_0f3c7e91a2b44d6e8c05";
export const ADA = { "x-forwarded-email": "ada@acme.dev" };

/** The button "Run again" of a run page, if it has one. */
export const retryButton = (page: Page) => page.queryByRole("button", { name: "Run again" });

/** Sends the form "run again" of the run page at this path, without following a redirect. */
export const sendRetryForm = (sut: Sut, runPath: string, headers: Record<string, string> = {}) =>
  sut.pages.send(`${runPath}/retry`, {}, { headers, follow: false });

/** Sends a form of a run page to its action with these fields and headers, without following a redirect. */
export const sendForm = (
  sut: Sut,
  action: string,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
) => sut.pages.send(action, fields, { headers, follow: false });

/** The names of the page's buttons. */
export const buttons = (page: Page): string[] => page.queryAllByRole("button").map((button) => button.name);

export const GATE = "g0123456789abcdef";

/** A blocked run whose stage "ship" waits at the gate GATE. */
export const gatedRun = () =>
  runOf("Export reports as CSV", {
    state: "blocked",
    stages: [
      { stage: "plan", agent: "planner", state: "succeeded" },
      { stage: "ship", agent: "shipper", state: "blocked", gateId: GATE },
    ],
  });

/** gatekeeper's view of GATE, pending for "leads". */
export const pendingGate = {
  id: GATE,
  workItem: "wi_0123456789abcdef0123",
  stage: "ship",
  summary: "Ship the CSV export",
  approvers: ["leads"],
  channel: "slack:C0GATES",
  state: "pending",
  waitingFor: ["leads"],
  requestedAt: "2025-12-31T23:58:00.000Z",
} as const;

/** The ID of the doctor's ping with the testkit's seed 1 (ADR 0120). */
export const PING = "ping_6b86b273ff34fce19d6b";

/** A NATS server in CONSOLE_NATS_URL, with the stream "OSF" of the foreman unless `stream` is false. */
export async function natsEnv(sut: Sut, fakes: Fakes, stream = true): Promise<Record<string, string>> {
  const nats = await fakes.nats();
  if (stream) await sut.events.stream(nats, "OSF", { subjects: ["osf.>"] });
  return { CONSOLE_NATS_URL: nats.url };
}

/** A healthy foreman in CONSOLE_FOREMAN_URL that shows the doctor's ping as received, or answers 404 for it. */
export async function pingedForeman(fakes: Fakes, received: boolean): Promise<Record<string, string>> {
  const ping = received
    ? { path: `/v1/doctor/pings/${PING}`, body: { id: PING, receivedAt: "2026-01-01T00:00:00Z" } }
    : { path: `/v1/doctor/pings/${PING}`, status: 404, body: { title: "No such ping" } };
  const api = await foreman(fakes, [], [ping, { path: "/v1/health", body: { status: "ok", checks: [] } }]);
  return { CONSOLE_FOREMAN_URL: api.url, CONSOLE_FOREMAN_TOKEN: "foreman-token" };
}
