import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";
import { type Run, usageLines } from "./input.ts";
import { SERVE } from "./server.ts";

scenario("SCN-GATE-118", async ({ sut, fakes, given, when, then }) => {
  const { slack, env } = await slackEnv(sut, fakes);
  await given("the README policy, groups and request", async () => {
    await putReadme(sut, fakes);
  });

  let runs: Run[] = [];
  await when(
    'the user runs "gatekeeper request" and "gatekeeper serve" with "OSF_NOW" set to "2026-01-01T05:00:00Z" and "OSF_TEST_HOOKS" set to ""',
    async () => {
      const hooked = { ...env, OSF_NOW: "2026-01-01T05:00:00Z", OSF_TEST_HOOKS: "" };
      runs = [await sut.cli(["request", ...GATE], { env: hooked }), await sut.cli(SERVE, { env: hooked })];
    },
  );

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2]);
  });

  await then(
    "each error output says that OSF_NOW is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests",
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual(
        usageLines(
          ["request", "serve"],
          () => "OSF_NOW is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests: unset OSF_NOW",
        ),
      );
    },
  );

  await then('the fake Slack has no message in "C0GATES"', async () => {
    expect(slack.messages("C0GATES")).toEqual([]);
  });
});
