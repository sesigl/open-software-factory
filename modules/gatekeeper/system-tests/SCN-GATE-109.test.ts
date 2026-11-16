import { scenario } from "@opensoftware/testkit";
import { slackEnv } from "./gate.ts";
import { type GateAnswer, linking, otherForge, prServing, pullRequestAt } from "./server.ts";

scenario("SCN-GATE-109", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof prServing>>;
  let slack: Awaited<ReturnType<typeof slackEnv>>["slack"];
  await given(
    'the server runs with "GATEKEEPER_FORGE_TOKEN", "GATEKEEPER_FORGE_URL" and the channel "slack:C0GATES"',
    async () => {
      const channel = await slackEnv(sut, fakes);
      slack = channel.slack;
      const env = { ...channel.env, GATEKEEPER_SLACK_SIGNING_SECRET: slack.signingSecret };
      server = await prServing(sut, fakes, env, { args: ["--channel", "slack:C0GATES"] });
    },
  );

  let other: Awaited<ReturnType<typeof otherForge>>;
  await given(
    'another forge, at another address, has the pull request "acme/web#12" with an "/approve" of "github:sesigl"',
    async () => {
      other = await otherForge(fakes);
    },
  );

  let answer: GateAnswer;
  await when(
    'a program posts a request that links only the pull request "acme/web#12" of the other forge to "/v1/gates"',
    async () => {
      answer = await server.post(linking(pullRequestAt(other.url)));
    },
  );

  await then(
    'the answer has the status 201 and a gate in the state "pending" for the channel "slack:C0GATES"',
    async () => {
      expect(answer.response.status, JSON.stringify(answer.error)).toBe(201);
      expect(answer.data).toMatchObject({ channel: "slack:C0GATES", state: "pending", waitingFor: ["maintainers"] });
    },
  );

  await then(
    'the Slack channel "C0GATES" has a message that asks "maintainers" with the buttons "Approve" and "Reject"',
    async () => {
      const [message] = slack.messages("C0GATES");
      expect(message?.text).toMatch(/^Approval needed from maintainers: Implement the research skill/);
      expect(message?.buttons.map((button) => button.text)).toEqual(["Approve", "Reject"]);
    },
  );

  await then("neither forge got a call", async () => {
    expect(other.requests()).toEqual([]);
    expect(server.http.requests()).toEqual([]);
  });
});
