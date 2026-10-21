import { scenario } from "@opensoftware/testkit";
import { jsonl, scoreRecord } from "./runs.ts";

scenario("SCN-SCORE-023", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" with 4 scores of "redundant-tests", 3 with the value 1 and 1 with the value 0, each with the judge cost 0.01',
    async () => {
      const scores = (["run-01", "run-02", "run-03", "run-04"] as const).map((run, index) =>
        scoreRecord(run, index < 3 ? 1 : 0, { cost: 0.01, timestamp: `2026-01-01T0${index}:00:00Z` }),
      );
      await sut.files.put("$INPUT/scores.jsonl", jsonl(scores));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit report scores.jsonl"', async () => {
    run = await sut.cli(["report", "scores.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"report.json" shows "redundant-tests" with 4 runs scored, 3 passes, 1 fail, the pass rate 0.75 and the cost 0.04',
    async () => {
      expect(JSON.parse(await sut.files.read("$OUTPUT/report.json")).scorers).toMatchObject([
        { name: "redundant-tests", scored: 4, passes: 3, fails: 1, passRate: 0.75, costUsd: 0.04 },
      ]);
    },
  );

  await then('"report.json" lists each run of "redundant-tests" with its result, reason, time and cost', async () => {
    const [scorer] = JSON.parse(await sut.files.read("$OUTPUT/report.json")).scorers;
    expect(scorer.runs).toEqual([
      expect.objectContaining({
        run: "run-01",
        result: "pass",
        reason: "Fine.",
        timestamp: "2026-01-01T00:00:00Z",
        costUsd: 0.01,
      }),
      expect.objectContaining({
        run: "run-02",
        result: "pass",
        reason: "Fine.",
        timestamp: "2026-01-01T01:00:00Z",
        costUsd: 0.01,
      }),
      expect.objectContaining({
        run: "run-03",
        result: "pass",
        reason: "Fine.",
        timestamp: "2026-01-01T02:00:00Z",
        costUsd: 0.01,
      }),
      expect.objectContaining({
        run: "run-04",
        result: "fail",
        reason: "Not fine.",
        timestamp: "2026-01-01T03:00:00Z",
        costUsd: 0.01,
      }),
    ]);
  });
});
