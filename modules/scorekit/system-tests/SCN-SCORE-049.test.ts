import { scenario } from "@opensoftware/testkit";
import { callFor, jsonl, outputScores, runIds, runsFile, scoreRecord, verdict } from "./runs.ts";

scenario("SCN-SCORE-049", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the 4 runs "run-01" to "run-04"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(runIds(4)));
  });

  await given(
    '"scores.jsonl" already holds a score of "redundant-tests" for "run-01" and a score of "scope-creep" for "run-02"',
    async () => {
      await sut.files.put(
        "$OUTPUT/scores.jsonl",
        jsonl([scoreRecord("run-01", 1), scoreRecord("run-02", 1, { name: "scope-creep" })]),
      );
    },
  );

  let url = "";
  await given('a model gateway that passes "run-02" and fails "run-03" and "run-04"', async () => {
    const gateway = await fakes.modelGateway([
      { when: callFor("run-02"), reply: verdict("pass", "Fine.") },
      { when: callFor("run-03"), reply: verdict("fail", "Not fine.") },
      { when: callFor("run-04"), reply: verdict("fail", "Not fine.") },
    ]);
    url = gateway.url;
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"', async () => {
    run = await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: url },
    });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "scored 3 of 4 runs with redundant-tests: 1 pass, 2 fail, 1 already scored"', async () => {
    expect(run.stdout).toBe("scored 3 of 4 runs with redundant-tests: 1 pass, 2 fail, 1 already scored\n");
  });

  await then(
    '"scores.jsonl" holds the value 1 for "run-02" and the value 0 for "run-03" and "run-04" of "redundant-tests"',
    async () => {
      const added = (await outputScores(sut))
        .slice(2)
        .map((score) => [score.name, score.metadata["osf.run.id"], score.value]);
      expect(added).toEqual([
        ["redundant-tests", "run-02", 1],
        ["redundant-tests", "run-03", 0],
        ["redundant-tests", "run-04", 0],
      ]);
    },
  );
});
