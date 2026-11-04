import { scenario } from "@opensoftware/testkit";
import { type GateAnswer, prRequest, prServing } from "./server.ts";

scenario("SCN-GATE-066", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof prServing>>;
  await given('the server runs with "GATEKEEPER_FORGE_TOKEN" and without a Slack channel', async () => {
    server = await prServing(sut, fakes);
  });

  let answer: GateAnswer;
  await when('a program posts a request that links only the issue "acme/web#7" to "/v1/gates"', async () => {
    answer = await server.post(prRequest([{ url: "https://github.com/acme/web/issues/7", title: "Issue" }]));
  });

  await then(
    'the answer has the status 400 and a problem whose detail says "the request links no pull request"',
    async () => {
      expect(answer.response.status).toBe(400);
      expect(answer.error).toMatchObject({
        status: 400,
        detail: expect.stringContaining("the request links no pull request"),
      });
    },
  );

  await then("the forge has no comment and no commit status", async () => {
    expect(server.http.requests().filter((line) => line.startsWith("POST"))).toEqual([]);
  });
});
