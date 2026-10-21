import { scenario } from "@opensoftware/testkit";
import { ANY_CALL, outputScores, runsFile, runsOf, verdict } from "./runs.ts";

scenario("SCN-SCORE-018", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs/a.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs/a.jsonl", runsFile(["run-01"]));
  });

  await given('the runs file "runs/b.jsonl" with the run "run-02"', async () => {
    await sut.files.put("$INPUT/runs/b.jsonl", runsFile(["run-02"]));
  });

  let url = "";
  await given(
    'a model gateway that answers every judge call with the result "pass" and the reason "Fine."',
    async () => {
      url = (await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("pass", "Fine.") }])).url;
    },
  );

  await when('the user runs "scorekit score --scorer redundant-tests --sample 1 runs"', async () => {
    await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs"], {
      env: { SCOREKIT_INFERENCE_URL: url },
    });
  });

  await then('"scores.jsonl" holds scores for exactly the runs "run-01" and "run-02"', async () => {
    expect(runsOf(await outputScores(sut))).toEqual(["run-01", "run-02"]);
  });
});
