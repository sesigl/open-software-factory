import { scenario } from "@opensoftware/testkit";
import { AUTH, serving } from "./server.ts";

scenario("SCN-GATE-046", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server runs with a policy whose "approvers" is empty for the channel "slack:C0GATES"', async () => {
    server = await serving(sut, fakes, {
      change: { "policy.rego": "package gatekeeper\n\napprovers := set()\n" },
    });
  });

  let answer: Awaited<ReturnType<ReturnType<typeof server.api>["POST"]>>;
  await when('a program posts a request for a change of "docs/guide.md" to "/v1/gates"', async () => {
    answer = await server.api().POST("/v1/gates", {
      body: { workItem: "WI-7", stage: "merge", summary: "Fix a typo", change: { paths: ["docs/guide.md"] } },
      headers: AUTH,
    });
  });

  await then('the answer has the status 201 and a gate in the state "approved"', async () => {
    expect(answer.response.status, JSON.stringify(answer.error)).toBe(201);
    expect(answer.data).toMatchObject({ state: "approved", approvers: [] });
    expect(answer.data?.waitingFor).toBeUndefined();
  });

  await then('the gate\'s record has the decision "approved" by the trigger "policy:policy.rego"', async () => {
    expect(answer.data?.record).toMatchObject({
      decision: "approved",
      decidedBy: { kind: "trigger", id: "policy:policy.rego" },
      decidedAt: "2026-01-01T00:00:00.000000Z",
      channel: "slack:C0GATES",
    });
  });

  await then('the Slack channel "C0GATES" has no message', async () => {
    expect(server.slack.messages("C0GATES")).toEqual([]);
  });
});
