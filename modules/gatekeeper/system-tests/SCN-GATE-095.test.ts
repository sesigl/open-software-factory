import { scenario } from "@opensoftware/testkit";
import { replies } from "./gate.ts";
import { AUTH, askedServer } from "./server.ts";

scenario("SCN-GATE-095", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given('the server asked "maintainers" for approval of the README request', async () => {
    server = await askedServer(sut, fakes);
  });

  let answer: Awaited<ReturnType<ReturnType<typeof server.api>["POST"]>>;
  await when(
    'a program posts to "/v1/gates/<gate>/decisions" the decision "rejected" by the person "slack:U0ADA" with the reason "needs a test"',
    async () => {
      answer = await server.api().POST("/v1/gates/{gateId}/decisions", {
        params: { path: { gateId: server.id } },
        body: { decision: "rejected", by: { kind: "person", id: "slack:U0ADA" }, reason: "needs a test" },
        headers: AUTH,
      });
    },
  );

  await then(
    'the answer shows the state "rejected" and a record rejected by the person "slack:U0ADA" with the reason "needs a test"',
    async () => {
      expect(answer.response.status).toBe(200);
      expect(answer.data).toMatchObject({ id: server.id, state: "rejected" });
      expect((answer.data as { record?: unknown }).record).toMatchObject({
        gate: server.id,
        decision: "rejected",
        decidedBy: { kind: "person", id: "slack:U0ADA" },
        reason: "needs a test",
      });
      expect(await server.gate(server.id)).toMatchObject({ state: "rejected" });
    },
  );

  await then('the thread has the reply "Rejected by <@U0ADA>: needs a test."', async () => {
    expect(replies(server.slack, server.message)).toEqual([
      expect.stringMatching(/^Rejected by <@U0ADA>: needs a test\.\n\[gatekeeper g[0-9a-f]{16} decided\]$/),
    ]);
  });
});
