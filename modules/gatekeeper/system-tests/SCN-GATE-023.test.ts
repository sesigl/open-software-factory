import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-023", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(fakes);
  await given(
    'the README policy, groups and request, and no approval request in the Slack channel "C0GATES"',
    async () => {
      await putReadme(sut, fakes);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["status", ...GATE], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error output says that "slack:C0GATES" has no request for the gate and to run "gatekeeper request" first',
    async () => {
      expect(run.stderr).toMatch(
        /slack:C0GATES has no request for the gate g[0-9a-f]{16}: run "gatekeeper request" first/,
      );
    },
  );
});
