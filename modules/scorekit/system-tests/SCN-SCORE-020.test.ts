import { scenario } from "@opensoftware/testkit";
import { callFor, labelsFile, runsFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-020", async ({ sut, fakes, given, when, then }) => {
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

  await when(
    'the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl runs.jsonl"',
    async () => {
      await sut.cli(["calibrate", "--scorer", "redundant-tests", "--labels", "labels.jsonl", "runs.jsonl"], {
        env: { SCOREKIT_INFERENCE_URL: url },
      });
    },
  );

  await then(
    '"calibration.json" lists the disagreement "run-02" with the label "pass", the result "fail" and the reason "The tests repeat each other."',
    async () => {
      expect(JSON.parse(await sut.files.read("$OUTPUT/calibration.json")).disagreements).toEqual([
        { run: "run-02", label: "pass", result: "fail", reason: "The tests repeat each other." },
      ]);
    },
  );
});
