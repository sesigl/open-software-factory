import { scenario } from "@opensoftware/testkit";
import { type GateAnswer, linking, otherForge, prServing, pullRequestAt } from "./server.ts";

scenario("SCN-GATE-110", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof prServing>>;
  await given(
    'the server runs with "GATEKEEPER_FORGE_TOKEN", without "GATEKEEPER_FORGE_URL" and without a Slack channel',
    async () => {
      server = await prServing(sut, fakes, {}, { without: ["GATEKEEPER_FORGE_URL"] });
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
    'the answer has the status 400 and a problem whose detail says "the request links no pull request on https://github.com"',
    async () => {
      expect(answer.response.status).toBe(400);
      expect(answer.error).toMatchObject({
        status: 400,
        detail:
          "the request links no pull request on https://github.com, like https://github.com/acme/web/pull/12, and the server has no Slack channel",
      });
    },
  );

  await then("the other forge got no call", async () => {
    expect(other.requests()).toEqual([]);
  });
});
