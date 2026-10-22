import { scenario } from "@opensoftware/testkit";
import { putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-001", async ({ sut, fakes, given, when, then }) => {
  const { slack, env } = await slackEnv(fakes);
  await given("the policy, the groups and the request from the README", async () => {
    await putReadme(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when("the user runs the quick start command from the README", async () => {
    run = await sut.cli(sut.readme.quickStartArgs(), { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the output folder contains the file the README promises", async () => {
    expect(await sut.files.list("$OUTPUT")).toContain(sut.readme.quickStartOutput());
  });

  await then(
    'the Slack channel "C0GATES" has a message that asks "maintainers" to approve "Merge the new checkout flow"',
    async () => {
      const [message] = slack.messages("C0GATES");
      expect(message?.text).toContain("Approval needed from maintainers (risk high): Merge the new checkout flow");
    },
  );
});
