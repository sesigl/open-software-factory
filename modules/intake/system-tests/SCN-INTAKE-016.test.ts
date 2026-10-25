import { scenario } from "@opensoftware/testkit";
import { slackServing } from "./server.ts";

const CHALLENGE = "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P";

scenario("SCN-INTAKE-016", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackServing>>;
  await given("the server runs with the Slack channel adapter", async () => {
    server = await slackServing(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when(
    'Slack sends the signed "url_verification" with the challenge "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"',
    async () => {
      const body = { token: "legacy", challenge: CHALLENGE, type: "url_verification" };
      answer = await sut.http.request("POST", "/slack/events", {
        body,
        headers: server.slack.sign(JSON.stringify(body)),
      });
    },
  );

  await then(
    'the answer has the status 200 and the challenge "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"',
    async () => {
      expect(answer.status).toBe(200);
      expect(answer.body).toEqual({ challenge: CHALLENGE });
    },
  );
});
