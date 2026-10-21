import { scenario } from "@opensoftware/testkit";
import { runsFile } from "./runs.ts";

scenario("SCN-SCORE-016", async ({ sut, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl" without "SCOREKIT_INFERENCE_URL"',
    async () => {
      run = await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs.jsonl"]);
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('the error output contains "SCOREKIT_INFERENCE_URL"', async () => {
    expect(run.stderr).toContain("SCOREKIT_INFERENCE_URL");
  });
});
