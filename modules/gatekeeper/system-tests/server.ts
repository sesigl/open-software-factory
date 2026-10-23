// Shared setup of the "gatekeeper serve" scenarios: PostgreSQL, fake Slack, the README's files and the typed client.
import type { GateRequest, paths } from "@opensoftware/contracts";
import type { Fakes, Sut } from "@opensoftware/testkit";
import { putReadme, readmeFiles } from "./gate.ts";

export const SERVE = ["serve", "--policy", "policy.rego", "--groups", "groups.json", "--channel", "slack:C0GATES"];
export const API_TOKEN = "testkit-api-token";
export const AUTH = { authorization: `Bearer ${API_TOKEN}` };

export const readmeRequest = (fakes: Fakes): GateRequest =>
  JSON.parse(readmeFiles(fakes)["request.json"] as string) as GateRequest;

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
    /** Stops the server and starts it again on the same database with these variables changed. */
    async restart(more: Record<string, string>) {
      await sut.http.stop();
      await start(more);
    },
    gate: async (id: string) =>
      (await api().GET("/v1/gates/{gateId}", { params: { path: { gateId: id } }, headers: AUTH })).data,
  };
}

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
