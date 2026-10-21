import { scenario } from "@opensoftware/testkit";
import { callFor, outputScores, runsFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-004", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let url = "";
  await given(
    'a model gateway that answers the judge call for "run-01" with the result "fail" and the reason "The second test repeats the first."',
    async () => {
      const gateway = await fakes.modelGateway([
        { when: callFor("run-01"), reply: verdict("fail", "The second test repeats the first.") },
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
    '"scores.jsonl" holds a score for "run-01" with the value 0 and the comment "The second test repeats the first."',
    async () => {
      expect(await outputScores(sut)).toMatchObject([
        { value: 0, comment: "The second test repeats the first.", metadata: { "osf.run.id": "run-01" } },
      ]);
    },
  );
});
