import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { callFor, jsonl, outputScores, runsFile, runsOf, scoreRecord, verdict } from "./runs.ts";

scenario("SCN-SCORE-011", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the runs "run-01" and "run-02"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01", "run-02"]));
  });

  await given('"scores.jsonl" already holds a score of "redundant-tests" for "run-01"', async () => {
    await sut.files.put("$OUTPUT/scores.jsonl", jsonl([scoreRecord("run-01", 1)]));
  });

  let gateway: ModelGateway;
  await given(
    'a model gateway that answers the judge call for "run-02" with the result "pass" and the reason "Fine."',
    async () => {
      gateway = await fakes.modelGateway([{ when: callFor("run-02"), reply: verdict("pass", "Fine.") }]);
    },
  );

  await when('the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"', async () => {
    await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then("the model gateway received 1 judge call", async () => {
    expect(gateway.calls).toHaveLength(1);
  });

  await then('"scores.jsonl" holds one score for "run-01" and one score for "run-02"', async () => {
    expect(runsOf(await outputScores(sut))).toEqual(["run-01", "run-02"]);
  });
});
