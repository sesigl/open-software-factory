import { scenario } from "@opensoftware/testkit";
import { ANY_CALL, outputScores, runIds, runsFile, runsOf, scorerFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-008", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the 10 runs "run-10" down to "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(runIds(10).reverse()));
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

  await when('the user runs "scorekit score --scorer scorers/sampled.md --seed 42 runs.jsonl"', async () => {
    await sut.cli(["score", "--scorer", "scorers/sampled.md", "--seed", "42", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: url },
    });
  });

  await then('"scores.jsonl" holds scores for exactly the runs "run-03" and "run-07"', async () => {
    expect(runsOf(await outputScores(sut))).toEqual(["run-03", "run-07"]);
  });
});
