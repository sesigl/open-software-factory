import { scenario } from "@opensoftware/testkit";
import { runsFile } from "./runs.ts";

scenario("SCN-SCORE-029", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer slow-tests runs.jsonl"', async () => {
    const gateway = await fakes.modelGateway([]);
    run = await sut.cli(["score", "--scorer", "slow-tests", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then(
    'the error output names the unknown scorer "slow-tests" and the pack scorer "redundant-tests"',
    async () => {
      expect(run.stderr).toContain('no scorer "slow-tests" in the pack');
      expect(run.stderr).toContain("redundant-tests");
    },
  );
});
