import { scenario } from "@opensoftware/testkit";
import { callFor, labelsFile, runsFile } from "./runs.ts";

/** 300 characters without a JSON object: 30 times "No verdict". */
const ANSWER = "No verdict".repeat(30);

scenario("SCN-SCORE-065", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  await given('the labels file "labels.jsonl" that labels "run-01" "pass"', async () => {
    await sut.files.put("$INPUT/labels.jsonl", labelsFile({ "run-01": "pass" }));
  });

  let url = "";
  await given(
    'a model gateway that answers the judge call for "run-01" with 300 characters that are not a verdict',
    async () => {
      url = (await fakes.modelGateway([{ when: callFor("run-01"), reply: ANSWER }])).url;
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

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    `the error output is "scorekit: run-01: the judge's answer is not a verdict: " and the first 200 characters of the answer`,
    async () => {
      expect(run.stderr).toBe(`scorekit: run-01: the judge's answer is not a verdict: ${ANSWER.slice(0, 200)}\n`);
    },
  );
});
