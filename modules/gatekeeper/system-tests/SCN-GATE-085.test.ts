import { scenario } from "@opensoftware/testkit";
import { putReadme, slackEnv } from "./gate.ts";
import { type Run, runEach } from "./input.ts";

const WRONG = ["slack:c0gates", "xslack:C0GATES", "slack:C0GATES#x"];

scenario("SCN-GATE-085", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(sut, fakes);
  await given("the README policy, groups and request", async () => {
    await putReadme(sut, fakes);
  });

  let runs: Run[] = [];
  await when(
    'the user runs "gatekeeper request" for the channels "slack:c0gates", "xslack:C0GATES" and "slack:C0GATES#x", and for "slack:C0GATES" without "GATEKEEPER_SLACK_TOKEN"',
    async () => {
      runs = await runEach(
        sut,
        [...WRONG, "slack:C0GATES"],
        (channel) => [
          "request",
          "--policy",
          "policy.rego",
          "--groups",
          "groups.json",
          "--channel",
          channel,
          "request.json",
        ],
        (channel) => (WRONG.includes(channel) ? env : {}),
      );
    },
  );

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2, 2]);
  });

  await then(
    'the error outputs say that each of the three channels is no channel like slack:C0GATES, and then "set GATEKEEPER_SLACK_TOKEN for a slack: channel"',
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual([
        ...WRONG.map((channel) => `gatekeeper: ${channel} is no channel like slack:C0GATES\n`),
        "gatekeeper: set GATEKEEPER_SLACK_TOKEN for a slack: channel\n",
      ]);
    },
  );
});
