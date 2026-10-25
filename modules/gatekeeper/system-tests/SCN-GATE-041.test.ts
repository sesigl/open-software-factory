import { scenario } from "@opensoftware/testkit";
import { AUTH, type GateAnswer, readmeRequest, serving } from "./server.ts";

scenario("SCN-GATE-041", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server runs with the README policy and groups for the channel "slack:C0GATES"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: GateAnswer;
  await when('a program posts the README request to "/v1/gates" with the API token', async () => {
    answer = await server.api().POST("/v1/gates", { body: readmeRequest(fakes), headers: AUTH });
  });

  await then(
    'the answer has the status 201 and a gate in the state "pending" that waits for "maintainers"',
    async () => {
      expect(answer.response.status, JSON.stringify(answer.error)).toBe(201);
      expect(answer.data).toMatchObject({
        id: expect.stringMatching(/^g[0-9a-f]{16}$/),
        workItem: "https://github.com/acme/web/pull/6",
        stage: "merge",
        risk: "high",
        approvers: ["maintainers"],
        escalateTo: ["leads"],
        channel: "slack:C0GATES",
        state: "pending",
        waitingFor: ["maintainers"],
        requestedAt: "2026-01-01T00:00:00.000001Z",
        expiresAt: "2026-01-03T00:00:00.000001Z",
      });
    },
  );

  await then(
    'the Slack channel "C0GATES" has a message that asks "maintainers" with the buttons "Approve" and "Reject"',
    async () => {
      const [message] = server.slack.messages("C0GATES");
      expect(message?.text).toMatch(/^Approval needed from maintainers \(risk high\): Merge the new checkout flow/);
      expect(message?.buttons.map((button) => button.text)).toEqual(["Approve", "Reject"]);
    },
  );
});
