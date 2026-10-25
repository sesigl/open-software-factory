import { scenario } from "@opensoftware/testkit";
import { putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-059", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(sut, fakes);
  await given("the policy, the groups and the request from the README", async () => {
    await putReadme(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs the quick start command from the README with "GATEKEEPER_SLACK_TOKEN" set to "xoxb-not-a-token"',
    async () => {
      run = await sut.cli(sut.readme.quickStartArgs(), { env: { ...env, GATEKEEPER_SLACK_TOKEN: "xoxb-not-a-token" } });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output says "the channel refused the token"', async () => {
    expect(run.stderr).toContain("the channel refused the token");
  });
});
