import { scenario } from "@opensoftware/testkit";
import { callFor, outputScores, runsFile, traceIdOf, verdict } from "./runs.ts";

scenario("SCN-SCORE-003", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let url = "";
  await given(
    'a model gateway that answers the judge call for "run-01" with the result "pass" and the reason "Each test proves a new behavior."',
    async () => {
      const gateway = await fakes.modelGateway([
        { when: callFor("run-01"), reply: verdict("pass", "Each test proves a new behavior.") },
      ]);
      url = gateway.url;
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"', async () => {
    run = await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: url },
    });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"scores.jsonl" holds a score for "run-01" with the name "redundant-tests", the value 1, the data type "BOOLEAN" and the comment "Each test proves a new behavior."',
    async () => {
      expect(await outputScores(sut)).toMatchObject([
        {
          name: "redundant-tests",
          value: 1,
          dataType: "BOOLEAN",
          comment: "Each test proves a new behavior.",
          metadata: { "osf.run.id": "run-01" },
        },
      ]);
    },
  );

  await then('the score carries the trace ID of "run-01", the source "API" and the judge model "judge"', async () => {
    const [score] = await outputScores(sut);
    expect(score).toMatchObject({
      traceId: traceIdOf("run-01"),
      source: "API",
      metadata: { "osf.judge.model": "judge" },
    });
  });
});
