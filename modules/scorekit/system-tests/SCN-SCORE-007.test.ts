import { scenario } from "@opensoftware/testkit";
import { ANY_CALL, outputScores, runIds, runsFile, runsOf, scorerFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-007", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the 10 runs "run-01" to "run-10"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(runIds(10)));
  });

  await given('the scorer file "scorers/sampled.md" with the sampling rate 0.2', async () => {
    await sut.files.put("$INPUT/scorers/sampled.md", scorerFile({ sample: 0.2 }));
  });

  let url = "";
  await given(
    'a model gateway that answers every judge call with the result "pass" and the reason "Fine."',
    async () => {
      url = (await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("pass", "Fine.") }])).url;
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer scorers/sampled.md --seed 42 runs.jsonl"', async () => {
    run = await sut.cli(["score", "--scorer", "scorers/sampled.md", "--seed", "42", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: url },
    });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"scores.jsonl" holds scores for exactly the runs "run-03" and "run-07"', async () => {
    expect(runsOf(await outputScores(sut))).toEqual(["run-03", "run-07"]);
  });

  await then('the output contains "scored 2 of 10 runs"', async () => {
    expect(run.stdout).toContain("scored 2 of 10 runs");
  });
});
