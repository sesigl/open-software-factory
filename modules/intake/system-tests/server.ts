// Shared setup of the intake scenarios: the README's work, the server with its token, fake Slack, fake GitHub with a
// webhook to the server, and the MCP client.
import type { paths, WorkItemView, WorkSubmission } from "@opensoftware/contracts";
import type { Fakes, Sut } from "@opensoftware/testkit";

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
    /** Stops the server and starts it again with the same data folder and these variables changed. */
    async restart(more: Record<string, string> = {}) {
      await sut.http.stop();
      url = await sut.http.start(["serve"], { env: { INTAKE_API_TOKEN: API_TOKEN, ...env, ...more } });
    },
  };
}

/** The server received the README's work; returns its ID. */
export async function received(sut: Sut, fakes: Fakes, env: Record<string, string> = {}) {
  const server = await serving(sut, env);
  const { data, response } = await server.submit(readmeWork(fakes));
  if (response.status !== 201 || !data) throw new Error(`POST /v1/work-items answered ${response.status}`);
  return { ...server, id: data.workItem.id };
}

/** The server with fake Slack behind the built channel-slack adapter, and these variables. */
export async function slackServing(sut: Sut, fakes: Fakes, env: Record<string, string> = {}) {
  const slack = await fakes.slack();
  const server = await serving(sut, {
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

/** "intake mcp" connected to the server as the person "github:varun". */
export const connectMcp = (sut: Sut, url: string, token = API_TOKEN) =>
  sut.mcp.connect(["mcp"], { env: { INTAKE_URL: url, INTAKE_API_TOKEN: token, INTAKE_REQUESTER: "github:varun" } });

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
export async function githubTo(fakes: Fakes, url: string, secret = WEBHOOK_SECRET) {
  const github = await fakes.github();
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
  const server = await serving(sut, forgeEnv(sut));
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
