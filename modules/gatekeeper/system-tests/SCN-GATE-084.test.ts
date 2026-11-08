import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";
import { type Run, runEach, usageLines } from "./input.ts";

const TIMES = ["2026-01-01 05:00", "2026-01-01T05:00:00Z!", "2026-13-45T05:00:00Z"];

scenario("SCN-GATE-084", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(sut, fakes);
  await given("the README policy, groups and request", async () => {
    await putReadme(sut, fakes);
  });

  let runs: Run[] = [];
  await when(
    'the user runs "gatekeeper request" with "OSF_NOW" set to "2026-01-01 05:00", "2026-01-01T05:00:00Z!" and "2026-13-45T05:00:00Z"',
    async () => {
      runs = await runEach(
        sut,
        TIMES,
        () => ["request", ...GATE],
        (time) => ({ ...env, OSF_NOW: time }),
      );
    },
  );

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2]);
  });

  await then("each error output says that the time is not a time like 2026-01-01T05:00:00Z", async () => {
    expect(runs.map((run) => run.stderr)).toEqual(
      usageLines(TIMES, (time) => `${time} is not a time like 2026-01-01T05:00:00Z`),
    );
  });
});
