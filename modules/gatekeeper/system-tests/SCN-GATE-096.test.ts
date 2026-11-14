import { scenario } from "@opensoftware/testkit";
import { AUTH, askedServer } from "./server.ts";

scenario("SCN-GATE-096", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given('the server asked "maintainers" for approval of the README request', async () => {
    server = await askedServer(sut, fakes);
  });

  let answer: Awaited<ReturnType<ReturnType<typeof server.api>["POST"]>>;
  await when(
    'a program posts to "/v1/gates/<gate>/decisions" the decision "approved" by the person "slack:U0LEO"',
    async () => {
      answer = await server.api().POST("/v1/gates/{gateId}/decisions", {
        params: { path: { gateId: server.id } },
        body: { decision: "approved", by: { kind: "person", id: "slack:U0LEO" } },
        headers: AUTH,
      });
    },
  );

  await then(
    'the answer has the status 403 and a problem whose detail says "slack:U0LEO is not in maintainers"',
    async () => {
      expect(answer.response.status).toBe(403);
      expect(answer.error).toMatchObject({ status: 403, detail: "slack:U0LEO is not in maintainers" });
    },
  );

  await then('"/v1/gates/<gate>" still shows the state "pending"', async () => {
    expect(await server.gate(server.id)).toMatchObject({ state: "pending", waitingFor: ["maintainers"] });
  });
});
