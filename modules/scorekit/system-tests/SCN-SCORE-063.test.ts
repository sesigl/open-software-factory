import { scenario } from "@opensoftware/testkit";
import { callFor, labelsFile, runIds, runsFile, verdict } from "./runs.ts";

const MINIMUMS = ["0", "0.333333", "1"];

scenario("SCN-SCORE-063", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the runs "run-01" to "run-03"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(runIds(3)));
  });

  await given(
    'the labels file "labels.jsonl" that labels "run-01" "pass", "run-02" "fail" and "run-03" "pass"',
    async () => {
      await sut.files.put("$INPUT/labels.jsonl", labelsFile({ "run-01": "pass", "run-02": "fail", "run-03": "pass" }));
    },
  );

  let url = "";
  await given('a model gateway that passes "run-01" and "run-02" and fails "run-03"', async () => {
    const gateway = await fakes.modelGateway([
      { when: callFor("run-01"), reply: verdict("pass", "Fine.") },
      { when: callFor("run-02"), reply: verdict("pass", "Fine.") },
      { when: callFor("run-03"), reply: verdict("fail", "Not fine.") },
    ]);
    url = gateway.url;
  });

  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when(
    'the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl runs.jsonl" with "--min-agreement" 0, 0.333333 and 1',
    async () => {
      runs = await Promise.all(
        MINIMUMS.map((minimum) =>
          sut.cli(
            [
              "calibrate",
              "--scorer",
              "redundant-tests",
              "--labels",
              "labels.jsonl",
              "--min-agreement",
              minimum,
              "--out",
              `calibration-${minimum}.json`,
              "runs.jsonl",
            ],
            { env: { SCOREKIT_INFERENCE_URL: url } },
          ),
        ),
      );
    },
  );

  await then("the commands exit with the codes 0, 0 and 1", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([0, 0, 1]);
  });

  await then(
    'the outputs are "agreement 1 of 3 (33.3%), kappa -0.50" twice and then "agreement 1 of 3 (33.3%) is below 100.0%"',
    async () => {
      expect(runs.map((run) => run.stdout)).toEqual([
        "agreement 1 of 3 (33.3%), kappa -0.50\n",
        "agreement 1 of 3 (33.3%), kappa -0.50\n",
        "agreement 1 of 3 (33.3%) is below 100.0%\n",
      ]);
    },
  );
});
