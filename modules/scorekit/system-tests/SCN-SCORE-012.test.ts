import { scenario } from "@opensoftware/testkit";
import { callFor, outputScores, runsFile } from "./runs.ts";

scenario("SCN-SCORE-012", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let url = "";
  await given('a model gateway that answers the judge call for "run-01" with "Verdict: {pass}"', async () => {
    url = (await fakes.modelGateway([{ when: callFor("run-01"), reply: "Verdict: {pass}" }])).url;
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"', async () => {
    run = await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: url },
    });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(`the error output contains "run-01: the judge's answer is not a verdict"`, async () => {
    expect(run.stderr).toContain("run-01: the judge's answer is not a verdict");
  });

  await then('"scores.jsonl" holds no score', async () => {
    expect(await outputScores(sut)).toEqual([]);
  });
});
