import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, request, slackEnv } from "./gate.ts";

scenario("SCN-GATE-005", async ({ sut, fakes, given, when, then }) => {
  const { slack, env } = await slackEnv(fakes);
  await given('the README policy, which gives the risk "low" to a change outside "contracts/"', async () => {
    await putReadme(sut, fakes);
  });

  await given('a request for a change of "README.md"', async () => {
    await sut.files.put("$INPUT/request.json", request(["README.md"]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["request", ...GATE], { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the Slack channel "C0GATES" has a message that asks "reviewers" to approve the change with the risk "low"',
    async () => {
      expect(slack.messages("C0GATES")[0]?.text).toContain("Approval needed from reviewers (risk low): Merge it");
    },
  );
});
