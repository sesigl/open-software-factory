// Shared setup of the intake scenarios: the README's work, the server with its token, fake Slack, fake GitHub with a
// webhook to the server, and the MCP client.

import type { paths, WorkItemView, WorkSubmission } from "@opensoftware/contracts";
import type { FakeGitHub, Fakes, Sut } from "@opensoftware/testkit";

export const API_TOKEN = "testkit-api-token";
export const AUTH = { authorization: `Bearer ${API_TOKEN}` };
export const CHANNEL = "C0WORK";
export const WEBHOOK_SECRET = "whsec-51c2";
export const ISSUE = "Export reports as CSV";

/** The fenced blocks of the README that name a file, like ```json work.json. */
export function readmeFiles(fakes: Fakes): Record<string, string> {
  const readme = fakes.fromRepository("modules/intake")["README.md"] as string;
  const files: Record<string, string> = {};
  for (const block of readme.matchAll(/^```\w+ (\S+)\n([\s\S]*?)^```$/gm))
    files[block[1] as string] = block[2] as string;
  return files;
}

export const readmeWork = (fakes: Fakes): WorkSubmission =>
  JSON.parse(readmeFiles(fakes)["work.json"] as string) as WorkSubmission;

/** The README's work again, from Slack, with the same dedupe key. */
export const fromSlack = (fakes: Fakes): WorkSubmission => ({
  ...readmeWork(fakes),
  origin: { source: "slack", url: "https://testkit.slack.com/archives/C0WORK/p1767225600000001" },
});

/** Starts "intake serve" with the API token and these variables. */
export async function serving(sut: Sut, env: Record<string, string> = {}) {
  let url = await sut.http.start(["serve"], { env: { INTAKE_API_TOKEN: API_TOKEN, ...env } });
  const api = () => sut.http.client<paths>();
  return {
    get url() {
      return url;
    },
    api,
    submit: (submission: WorkSubmission) => api().POST("/v1/work-items", { body: submission, headers: AUTH }),
    /** The answer of GET /v1/work-items?dedupeKey=<key>: its status and the work item, if any. */
    byKey: async (dedupeKey: string) => {
      const { data, response } = await api().GET("/v1/work-items", { params: { query: { dedupeKey } }, headers: AUTH });
      return { status: response.status, view: data as WorkItemView | undefined };
    },
    workItem: async (id: string): Promise<WorkItemView | undefined> =>
      (await api().GET("/v1/work-items/{workItemId}", { params: { path: { workItemId: id } }, headers: AUTH })).data,
    /** Stops the server. */
    stop: () => sut.http.stop(),
    /** Starts the stopped server again with the same data folder and these variables changed. */
    async start(more: Record<string, string> = {}) {
      url = await sut.http.start(["serve"], { env: { INTAKE_API_TOKEN: API_TOKEN, ...env, ...more } });
    },
    /** Stops the server and starts it again with the same data folder and these variables changed. */
    async restart(more: Record<string, string> = {}) {
      await sut.http.stop();
      url = await sut.http.start(["serve"], { env: { INTAKE_API_TOKEN: API_TOKEN, ...env, ...more } });
    },
  };
}

/**
 * "intake serve" with a PostgreSQL database of the scenario, as the profile runs it, and these variables. The
 * helpers below use it; a scenario that calls `serving` itself runs the embedded database of the README's quick start.
 */
async function servingOnPostgres(sut: Sut, fakes: Fakes, env: Record<string, string> = {}) {
  const url = env.INTAKE_DATABASE_URL ?? (await fakes.postgres()).url;
  return serving(sut, { ...env, INTAKE_DATABASE_URL: url });
}

/** The server received the README's work; returns its ID. */
export async function received(sut: Sut, fakes: Fakes, env: Record<string, string> = {}) {
  const server = await servingOnPostgres(sut, fakes, env);
  const { data, response } = await server.submit(readmeWork(fakes));
  if (response.status !== 201 || !data) throw new Error(`POST /v1/work-items answered ${response.status}`);
  return { ...server, id: data.workItem.id };
}

/** The server with fake Slack behind the built channel-slack adapter, and these variables. */
export async function slackServing(sut: Sut, fakes: Fakes, env: Record<string, string> = {}) {
  const slack = await fakes.slack();
  const server = await servingOnPostgres(sut, fakes, {
    INTAKE_SLACK_ADAPTER: sut.adapter("channel/slack"),
    INTAKE_SLACK_URL: slack.url,
    INTAKE_SLACK_TOKEN: slack.token,
    INTAKE_SLACK_SIGNING_SECRET: slack.signingSecret,
    ...env,
  });
  slack.deliverTo(`${server.url}/slack/events`);
  const replies = () => slack.messages(CHANNEL).filter((message) => message.user === slack.bot);
  return { ...server, slack, replies };
}

/** "intake mcp" connected to the server as the person "github:varun", with these variables. */
export const connectMcp = (sut: Sut, url: string, token = API_TOKEN, env: Record<string, string> = {}) =>
  sut.mcp.connect(["mcp"], {
    env: { INTAKE_URL: url, INTAKE_API_TOKEN: token, INTAKE_REQUESTER: "github:varun", ...env },
  });

export const FOREMAN_TOKEN = "testkit-foreman-token";

/** A foreman's API that has the run RUN of the work item, with its pull request and two stages. */
export async function foremanWith(fakes: Fakes, workItem: WorkItemView["workItem"]) {
  const run = {
    runId: RUN,
    workItem,
    factory: "hello",
    factoryVersion: "0a1b2c3",
    state: "complete",
    pullRequest: "https://github.com/acme/web/pull/7",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:05:00.000Z",
    stages: [
      { stage: "plan", agent: "plan", state: "succeeded", sessionId: "sess-plan" },
      { stage: "implement", agent: "implement", state: "succeeded", sessionId: "sess-implement" },
    ],
  };
  const http = await fakes.http([{ path: `/v1/runs/${RUN}`, body: run }]);
  return { ...http, run, env: { INTAKE_FOREMAN_URL: http.url, INTAKE_FOREMAN_TOKEN: FOREMAN_TOKEN } };
}

/** The text of a tool's answer. */
export const toolText = (result: unknown): string =>
  ((result as { content: { type: string; text: string }[] }).content[0]?.text as string) ?? "";

/** The variables of the built forge-github adapter with the webhook secret. */
export const forgeEnv = (sut: Sut): Record<string, string> => ({
  INTAKE_FORGE_ADAPTER: sut.adapter("forge/github"),
  INTAKE_WEBHOOK_SECRET: WEBHOOK_SECRET,
});

/**
 * Fake GitHub with the repository "tester/web" and a webhook for labels on issues to `url`, as
 * `forge-github webhook tester/web <url> --event issue.labeled` registers it, signed with `secret`.
 */
export async function githubTo(fakes: Fakes, url: string, secret = WEBHOOK_SECRET, started?: FakeGitHub) {
  const github = started ?? (await fakes.github());
  await github.createRepository("web");
  const answer = await fetch(`${github.url}/repos/tester/web/hooks`, {
    method: "POST",
    headers: { authorization: `Bearer ${github.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["issues"],
      config: { url, content_type: "json", secret },
    }),
  });
  if (answer.status !== 201) throw new Error(`fake GitHub answered ${answer.status} to the webhook`);
  /** Adds the label to the issue "Export reports as CSV", which it opens unless `number` names one. */
  const labeled = async (label: string, number?: number) => {
    const issue = number ?? (await github.openIssue("web", { title: ISSUE, body: "Finance needs it monthly" })).number;
    await github.label("web", issue, label);
    return { number: issue, url: `${github.url}/tester/web/issues/${issue}` };
  };
  return { github, labeled };
}

/** The server with the forge adapter, and fake GitHub's webhook to its /forge/events. */
export async function forgeServing(sut: Sut, fakes: Fakes) {
  const server = await servingOnPostgres(sut, fakes, forgeEnv(sut));
  return { ...server, ...(await githubTo(fakes, `${server.url}/forge/events`)) };
}

/**
 * A receiver that keeps fake GitHub's deliveries, and `forward`, which posts the label's delivery to the server's
 * /forge/events as it arrived and gives the server's status.
 */
export async function deliveries(fakes: Fakes) {
  const receiver = await fakes.http([{ method: "POST", path: "/forge", body: {} }]);
  const labelDelivery = () =>
    receiver.headers().findIndex((request, index) => {
      const body = JSON.parse(receiver.texts()[index]?.text || "{}") as { action?: string };
      return request.headers["x-github-event"] === "issues" && body.action === "labeled";
    });
  return {
    url: `${receiver.url}/forge`,
    async forward(serverUrl: string): Promise<number> {
      await expect.poll(labelDelivery, { timeout: 10_000, interval: 50 }).toBeGreaterThanOrEqual(0);
      const index = labelDelivery();
      const headers = receiver.headers()[index]?.headers ?? {};
      const names = ["content-type", "x-github-event", "x-github-delivery", "x-hub-signature-256"];
      const answer = await fetch(`${serverUrl}/forge/events`, {
        method: "POST",
        headers: Object.fromEntries(names.filter((name) => headers[name]).map((name) => [name, String(headers[name])])),
        body: receiver.texts()[index]?.text,
      });
      await answer.body?.cancel();
      return answer.status;
    },
  };
}

/** Polls the work item with the dedupe key until it is there. */
export async function eventually(server: Awaited<ReturnType<typeof serving>>, dedupeKey: string) {
  await expect.poll(async () => (await server.byKey(dedupeKey)).status, { timeout: 10_000, interval: 50 }).toBe(200);
  return (await server.byKey(dedupeKey)).view as WorkItemView;
}

export const RUN = "run_5d41402abc4b2a76b971";

/**
 * The foreman's "run.started@v1" for the work item, or with an outcome its "run.completed@v1", which lists the pull
 * requests when there are some.
 */
export function runEvent(workItemId: string, outcome?: "succeeded" | "failed" | "cancelled", pullRequests?: string[]) {
  const data = {
    runId: RUN,
    workItemId,
    factoryVersion: "0a1b2c3",
    startedAt: "2026-01-01T00:00:00Z",
    requester: { kind: "person", id: "slack:U024BE7LH", displayName: "Varun" },
    source: "slack",
  };
  return outcome
    ? {
        specversion: "1.0",
        id: `${RUN}.completed`,
        source: "/osf/foreman",
        type: "run.completed@v1",
        time: "2026-01-01T00:05:00Z",
        subject: RUN,
        data: { ...data, outcome, endedAt: "2026-01-01T00:05:00Z", ...(pullRequests ? { pullRequests } : {}) },
      }
    : {
        specversion: "1.0",
        id: `${RUN}.started`,
        source: "/osf/foreman",
        type: "run.started@v1",
        time: "2026-01-01T00:00:00Z",
        subject: RUN,
        data: { ...data, factory: "hello", stages: ["plan", "implement"] },
      };
}

/** The NATS subject of each run event. */
const SUBJECTS: Record<string, string> = {
  "run.started@v1": "osf.run.started.v1",
  "run.completed@v1": "osf.run.completed.v1",
  "gate.requested@v1": "osf.gate.requested.v1",
  "run.blocked@v1": "osf.run.blocked.v1",
};

export const CONSOLE_URL = "https://console.example";

/** The gatekeeper's "gate.requested@v1" for the work item at the stage, as gatekeeper publishes it: without the run. */
export function gateEvent(workItemId: string, stage: string, summary: string) {
  return {
    specversion: "1.0",
    id: "gate_7f3a.requested",
    source: "/osf/gatekeeper",
    type: "gate.requested@v1",
    time: "2026-01-01T00:02:00Z",
    subject: "gate_7f3a",
    data: { gateId: "gate_7f3a", workItemId, stage, policy: "policies/deploy.rego", approvers: ["leads"], summary },
  } as unknown as ReturnType<typeof runEvent>;
}

/** The foreman's "run.blocked@v1" for the work item: its stage waits for the checks of the pull request. */
export function blockedEvent(workItemId: string, stage: string, pullRequest: string) {
  return {
    specversion: "1.0",
    id: `${RUN}.blocked.${stage}`,
    source: "/osf/foreman",
    type: "run.blocked@v1",
    time: "2026-01-01T00:02:00Z",
    subject: RUN,
    data: {
      runId: RUN,
      workItemId,
      stage,
      waitsFor: "checks",
      pullRequest,
      checks: ["verify"],
      requester: { kind: "person", id: "slack:U024BE7LH", displayName: "Varun" },
      source: "slack",
    },
  } as unknown as ReturnType<typeof runEvent>;
}

/**
 * The server, with NATS, received the README's work; `publish` sends a run event of its work item as the foreman does,
 * and `until` reads the work item until it has the status.
 */
export async function following(sut: Sut, fakes: Fakes, env: Record<string, string> = {}) {
  const nats = await fakes.nats();
  const server = await received(sut, fakes, { INTAKE_NATS_URL: nats.url, ...env });
  const events = await sut.events.watch(nats, "osf.>");
  return {
    ...server,
    nats,
    publish: (event: ReturnType<typeof runEvent>) => events.publish(SUBJECTS[event.type] as string, event as never),
    async until(status: WorkItemView["status"]) {
      await expect
        .poll(async () => (await server.workItem(server.id))?.status, { timeout: 10_000, interval: 50 })
        .toBe(status);
      return (await server.workItem(server.id)) as WorkItemView;
    },
  };
}

/**
 * The server, with NATS and the Slack channel adapter, made a work item of a mention in CHANNEL; `publish` sends a run
 * event of its work item as the foreman does.
 */
export async function slackFollowing(sut: Sut, fakes: Fakes, env: Record<string, string> = {}) {
  const nats = await fakes.nats();
  const server = await slackServing(sut, fakes, { INTAKE_NATS_URL: nats.url, ...env });
  const events = await sut.events.watch(nats, "osf.>");
  const ts = (await server.slack.say({ channel: CHANNEL, text: `<@${server.slack.bot}> Export reports as CSV` })).ts;
  await expect.poll(() => server.replies().length, { timeout: 10_000, interval: 50 }).toBe(1);
  const id = /wi_[0-9a-f]{20}/.exec(server.replies()[0]?.text ?? "")?.[0] as string;
  return {
    ...server,
    id,
    ts,
    publish: (event: ReturnType<typeof runEvent>) => events.publish(SUBJECTS[event.type] as string, event as never),
  };
}

/** The run that runs the work item of RUN again (ADR 0105). */
export const RUN_AGAIN = "run_0f3c7e91a2b44d6e8c05";

/** The run event as the new run RUN_AGAIN publishes it, with the "retryOf" RUN. */
export function rerunEvent(event: ReturnType<typeof runEvent>): ReturnType<typeof runEvent> {
  const id = event.id.replace(RUN, RUN_AGAIN);
  const data = { ...event.data, runId: RUN_AGAIN, retryOf: RUN };
  return { ...event, id, subject: RUN_AGAIN, data } as ReturnType<typeof runEvent>;
}

export const RETRY_SUBJECT = "osf.work.retry-requested.v1";

/**
 * The server, with NATS and the GitHub forge adapter, made a work item of the issue ISSUE labeled "factory", and the
 * foreman published these run events of RUN for it; `relabel` removes the label and adds it again, and `settled`
 * resolves once the server handled every delivery before it: it labels another issue and waits for its work item's
 * "work.received@v1", which the outbox publishes after any event of an earlier delivery.
 */
export async function labeledFollowing(sut: Sut, fakes: Fakes, runEvents: ReturnType<typeof runEvent>[]) {
  const nats = await fakes.nats();
  const server = await servingOnPostgres(sut, fakes, { ...forgeEnv(sut), INTAKE_NATS_URL: nats.url });
  const forge = await githubTo(fakes, `${server.url}/forge/events`);
  const events = await sut.events.watch(nats, "osf.>");
  const retries = await sut.events.watch(nats, RETRY_SUBJECT);
  const issue = await forge.labeled("factory");
  const { workItem } = await eventually(server, issue.url);
  for (const event of runEvents) {
    const ours = { ...event, data: { ...event.data, workItemId: workItem.id } };
    await events.publish(SUBJECTS[event.type] as string, ours as never);
  }
  await expect
    .poll(async () => (await server.workItem(workItem.id))?.runId, { timeout: 10_000, interval: 50 })
    .toBe(RUN);
  let others = 0;
  return {
    ...server,
    ...forge,
    id: workItem.id,
    events,
    async relabel() {
      await forge.github.unlabel("web", issue.number, "factory");
      await forge.github.label("web", issue.number, "factory");
    },
    async settled() {
      others++;
      const other = await forge.github.openIssue("web", { title: `Other ${others}` });
      await forge.github.label("web", other.number, "factory");
      await events.received("work.received@v1", { count: 1 + others });
    },
    /** The events that arrived on RETRY_SUBJECT. */
    retries,
  };
}

/**
 * The server, with NATS, the GitHub forge adapter and a token of fake GitHub, made a work item of the issue ISSUE
 * labeled "factory"; `publish` sends a run event of its work item, and `comments` reads the issue's comments.
 */
export async function issueFollowing(sut: Sut, fakes: Fakes) {
  const nats = await fakes.nats();
  const started = await fakes.github();
  const server = await servingOnPostgres(sut, fakes, {
    ...forgeEnv(sut),
    INTAKE_NATS_URL: nats.url,
    INTAKE_FORGE_URL: started.url,
    INTAKE_FORGE_TOKEN: started.token,
  });
  const { github, labeled } = await githubTo(fakes, `${server.url}/forge/events`, WEBHOOK_SECRET, started);
  const events = await sut.events.watch(nats, "osf.>");
  const issue = await labeled("factory");
  const { workItem } = await eventually(server, issue.url);
  return {
    ...server,
    id: workItem.id,
    publish: (event: ReturnType<typeof runEvent>) => events.publish(SUBJECTS[event.type] as string, event as never),
    comments: () => github.comments({ repository: "web", number: issue.number }),
  };
}
