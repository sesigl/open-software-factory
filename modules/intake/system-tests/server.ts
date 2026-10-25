// Shared setup of the intake scenarios: the README's work, the server with its token, fake Slack and the MCP client.
import type { paths, WorkItemView, WorkSubmission } from "@opensoftware/contracts";
import type { Fakes, Sut } from "@opensoftware/testkit";

export const API_TOKEN = "testkit-api-token";
export const AUTH = { authorization: `Bearer ${API_TOKEN}` };
export const CHANNEL = "C0WORK";

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

/** The server with fake Slack behind the built channel-slack adapter. */
export async function slackServing(sut: Sut, fakes: Fakes) {
  const slack = await fakes.slack();
  const server = await serving(sut, {
    INTAKE_SLACK_ADAPTER: sut.adapter("channel/slack"),
    INTAKE_SLACK_URL: slack.url,
    INTAKE_SLACK_TOKEN: slack.token,
    INTAKE_SLACK_SIGNING_SECRET: slack.signingSecret,
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
