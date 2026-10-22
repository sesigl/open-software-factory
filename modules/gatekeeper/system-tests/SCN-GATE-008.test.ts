import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-008", async ({ sut, fakes, given, when, then }) => {
  const { slack, env } = await slackEnv(fakes);
  await given('a policy that names the approver group "security"', async () => {
    await putReadme(sut, fakes, { "policy.rego": 'package gatekeeper\n\napprovers contains "security"\n' });
  });

  await given('a groups file without "security"', async () => {});

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["request", ...GATE], { env });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says that the policy names the group "security", which the groups file does not define',
    async () => {
      expect(run.stderr).toContain('the policy names the group "security", which groups.json does not define');
    },
  );

  await then('the Slack channel "C0GATES" has no message', async () => {
    expect(slack.messages("C0GATES")).toEqual([]);
  });
});
