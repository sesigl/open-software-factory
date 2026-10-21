import { scenario } from "@opensoftware/testkit";
import { ANY_CALL, labelsFile, runsFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-022", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  await given('the labels file "labels.jsonl" that labels "run-01" "pass" and "run-02" "pass"', async () => {
    await sut.files.put("$INPUT/labels.jsonl", labelsFile({ "run-01": "pass", "run-02": "pass" }));
  });

  let url = "";
  await given(
    'a model gateway that answers every judge call with the result "pass" and the reason "Fine."',
    async () => {
      url = (await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("pass", "Fine.") }])).url;
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl runs.jsonl"',
    async () => {
      run = await sut.cli(["calibrate", "--scorer", "redundant-tests", "--labels", "labels.jsonl", "runs.jsonl"], {
        env: { SCOREKIT_INFERENCE_URL: url },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the error output contains "no run for the label of run-02"', async () => {
    expect(run.stderr).toContain("no run for the label of run-02");
  });

  await then('the output contains "agreement 1 of 1 (100.0%)"', async () => {
    expect(run.stdout).toContain("agreement 1 of 1 (100.0%)");
  });
});
