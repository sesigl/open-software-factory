import { scenario } from "@opensoftware/testkit";
import { callFor, labelsFile, runsFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-021", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the runs "run-01" and "run-02"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01", "run-02"]));
  });

  await given('the labels file "labels.jsonl" that labels "run-01" "pass" and "run-02" "pass"', async () => {
    await sut.files.put("$INPUT/labels.jsonl", labelsFile({ "run-01": "pass", "run-02": "pass" }));
  });

  let url = "";
  await given('a model gateway that fails "run-02" with the reason "The tests repeat each other."', async () => {
    const gateway = await fakes.modelGateway([
      { when: callFor("run-01"), reply: verdict("pass", "Fine.") },
      { when: callFor("run-02"), reply: verdict("fail", "The tests repeat each other.") },
    ]);
    url = gateway.url;
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl --min-agreement 0.8 runs.jsonl"',
    async () => {
      run = await sut.cli(
        [
          "calibrate",
          "--scorer",
          "redundant-tests",
          "--labels",
          "labels.jsonl",
          "--min-agreement",
          "0.8",
          "runs.jsonl",
        ],
        { env: { SCOREKIT_INFERENCE_URL: url } },
      );
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "agreement 1 of 2 (50.0%) is below 80.0%"', async () => {
    expect(run.stdout).toContain("agreement 1 of 2 (50.0%) is below 80.0%");
  });
});
