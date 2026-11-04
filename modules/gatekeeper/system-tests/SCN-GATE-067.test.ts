import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";

scenario("SCN-GATE-067", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper serve" without "--channel" and without "GATEKEEPER_FORGE_TOKEN"', async () => {
    run = await sut.cli(["serve", "--policy", "policy.rego", "--groups", "groups.json"], {
      env: {
        GATEKEEPER_DATABASE_URL: "postgres://gatekeeper@127.0.0.1:1/gatekeeper",
        GATEKEEPER_API_TOKEN: "testkit-api-token",
      },
    });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "serve needs a Slack channel, like --channel slack:C0GATES, or GATEKEEPER_FORGE_TOKEN"',
    async () => {
      expect(run.stderr).toMatch(
        /^gatekeeper: serve needs a Slack channel, like --channel slack:C0GATES, or GATEKEEPER_FORGE_TOKEN/,
      );
    },
  );
});
