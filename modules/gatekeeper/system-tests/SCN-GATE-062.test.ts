import { scenario } from "@opensoftware/testkit";
import { putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-062", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(sut, fakes);
  await given("the policy, the groups and the request from the README", async () => {
    await putReadme(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs the quick start command from the README with "GATEKEEPER_SLACK_ADAPTER" set to "echo hello"',
    async () => {
      run = await sut.cli(sut.readme.quickStartArgs(), { env: { ...env, GATEKEEPER_SLACK_ADAPTER: "echo hello" } });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(`the error output says 'the adapter "echo hello" printed a line that is not JSON'`, async () => {
    expect(run.stderr).toContain('the adapter "echo hello" printed a line that is not JSON');
  });
});
