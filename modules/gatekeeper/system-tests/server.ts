// Shared setup of the "gatekeeper serve" scenarios: PostgreSQL, fake Slack or the scripted forge, the README's files
// and the typed client.
import type { GateRequest, paths } from "@opensoftware/contracts";
import type { Fakes, Sut } from "@opensoftware/testkit";
import { forge, forgeEnv, PR, putMergeFiles, putReadme, readmeFiles } from "./gate.ts";

export const SERVE = ["serve", "--policy", "policy.rego", "--groups", "groups.json", "--channel", "slack:C0GATES"];
export const API_TOKEN = "testkit-api-token";
export const AUTH = { authorization: `Bearer ${API_TOKEN}` };

export const readmeRequest = (fakes: Fakes): GateRequest =>
  JSON.parse(readmeFiles(fakes)["request.json"] as string) as GateRequest;

const postGate = (sut: Sut, fakes: Fakes) =>
  sut.http.client<paths>().POST("/v1/gates", { body: readmeRequest(fakes), headers: AUTH });
/** The answer to POST /v1/gates; the client's POST without a path would be the union of every API's answers. */
export type GateAnswer = Awaited<ReturnType<typeof postGate>>;

/** Starts the server on a new database with the README's files, changed by `change`. */
export async function serving(
  sut: Sut,
  fakes: Fakes,
  options: { env?: Record<string, string>; change?: Record<string, string> } = {},
) {
  const [slack, db] = await Promise.all([fakes.slack(), fakes.postgres()]);
  await putReadme(sut, fakes, options.change);
  const env: Record<string, string> = {
    GATEKEEPER_SLACK_URL: slack.url,
    GATEKEEPER_SLACK_TOKEN: slack.token,
    GATEKEEPER_SLACK_SIGNING_SECRET: slack.signingSecret,
    GATEKEEPER_SLACK_ADAPTER: sut.adapter("channel/slack"),
    GATEKEEPER_DATABASE_URL: db.url,
    GATEKEEPER_API_TOKEN: API_TOKEN,
    ...options.env,
  };
  const start = async (more: Record<string, string> = {}) => {
    const url = await sut.http.start(SERVE, { env: { ...env, ...more } });
    slack.deliverTo(`${url}/slack/events`, `${url}/slack/actions`);
  };
  await start();
  const api = () => sut.http.client<paths>();
  return {
    slack,
    env,
    api,
    gate: gateOf(sut),
    /** Stops the server and starts it again on the same database with these variables changed. */
    async restart(more: Record<string, string>) {
      await sut.http.stop();
      await start(more);
    },
  };
}

/** GET /v1/gates/{gateId} with the API token. */
const gateOf = (sut: Sut) => async (id: string) =>
  (await sut.http.client<paths>().GET("/v1/gates/{gateId}", { params: { path: { gateId: id } }, headers: AUTH })).data;

/** The server asked for approval of the README request; returns the gate ID and the request message. */
export async function askedServer(
  sut: Sut,
  fakes: Fakes,
  options: { env?: Record<string, string>; change?: Record<string, string> } = {},
) {
  const server = await serving(sut, fakes, options);
  const { data, response } = await server.api().POST("/v1/gates", { body: readmeRequest(fakes), headers: AUTH });
  if (response.status !== 201 || !data) throw new Error(`POST /v1/gates answered ${response.status}`);
  const message = server.slack.messages("C0GATES")[0];
  if (!message) throw new Error("the server posted no request");
  return { ...server, id: data.id, message };
}

// The pull request acme/web#12 as the channel of a server without Slack (ADR 0080).

export const BRANCH = "observer/research-skill-used-1a2b3c4d";

/** A request of the stage "implement" whose links are these, by default the pull request acme/web#12. */
export const prRequest = (links = [{ url: PR, title: "Pull request" }]): GateRequest => ({
  workItem: "https://github.com/acme/web/issues/7",
  stage: "implement",
  summary: "Implement the research skill",
  links,
  change: { head: BRANCH },
});

/** Starts the server with the forge token, without a Slack channel, on a new database and the scripted forge. */
export async function prServing(sut: Sut, fakes: Fakes, env: Record<string, string> = {}) {
  const [http, db] = await Promise.all([forge(fakes, BRANCH), fakes.postgres()]);
  await putMergeFiles(sut);
  await sut.http.start(["serve", "--policy", "merge.rego", "--groups", "groups.json"], {
    env: {
      ...forgeEnv(sut, http),
      GATEKEEPER_DATABASE_URL: db.url,
      GATEKEEPER_API_TOKEN: API_TOKEN,
      GATEKEEPER_POLL_MS: "20",
      ...env,
    },
  });
  const api = () => sut.http.client<paths>();
  const gate = gateOf(sut);
  return {
    http,
    db,
    gate,
    post: (body: GateRequest) => api().POST("/v1/gates", { body, headers: AUTH }),
    /** Reads the gate until the server decided it. */
    async decided(id: string) {
      await expect.poll(async () => (await gate(id))?.state, { timeout: 10_000, interval: 20 }).not.toBe("pending");
      return gate(id);
    },
  };
}

/** The server asked for approval in a comment on the pull request; the forge lists that comment from then on. */
export async function askedOnPullRequest(sut: Sut, fakes: Fakes, env: Record<string, string> = {}) {
  const server = await prServing(sut, fakes, env);
  const { data, response } = await server.post(prRequest());
  const asked = server.http.received().find((call) => call.method === "POST" && call.path.endsWith("/comments"));
  if (response.status !== 201 || !data || !asked) throw new Error(`POST /v1/gates answered ${response.status}`);
  const body = (asked.body as { body: string }).body;
  server.http.comment({ id: 900, body, login: "gatekeeper-bot", at: "2026-01-01T00:00:00Z" });
  return { ...server, id: data.id };
}
