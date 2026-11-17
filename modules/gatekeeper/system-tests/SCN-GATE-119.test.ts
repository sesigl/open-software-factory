import { scenario } from "@opensoftware/testkit";
import { putReadme, slackEnv } from "./gate.ts";
import { type Run, runEach, usageLines } from "./input.ts";
import { API_TOKEN, SERVE } from "./server.ts";

const POLLS = ["0", "-5", "1s"];

scenario("SCN-GATE-119", async ({ sut, fakes, given, when, then }) => {
  const { slack, env } = await slackEnv(sut, fakes);
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  let runs: Run[] = [];
  await when('the user runs "gatekeeper serve" with "GATEKEEPER_POLL_MS" set to "0", "-5" and "1s"', async () => {
    // The server stops at the setting, before it reaches the database: no database runs at this address.
    const serving = {
      ...env,
      GATEKEEPER_SLACK_SIGNING_SECRET: slack.signingSecret,
      GATEKEEPER_DATABASE_URL: "postgres://gatekeeper@127.0.0.1:1/gatekeeper",
      GATEKEEPER_API_TOKEN: API_TOKEN,
    };
    runs = await runEach(
      sut,
      POLLS,
      () => SERVE,
      (poll) => ({ ...serving, GATEKEEPER_POLL_MS: poll }),
    );
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2]);
  });

  await then(
    "each error output says that GATEKEEPER_POLL_MS needs a whole number of 1 or more, like 'GATEKEEPER_POLL_MS is \"1s\": set a whole number of 1 or more'",
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual(
        usageLines(POLLS, (poll) => `GATEKEEPER_POLL_MS is "${poll}": set a whole number of 1 or more`),
      );
    },
  );
});
