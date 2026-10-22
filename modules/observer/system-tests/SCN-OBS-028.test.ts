import { scenario } from "@opensoftware/testkit";
import { jsonl, MERGED_AT, runRecord, scores } from "./scores.ts";

scenario("SCN-OBS-028", async ({ sut, given, when, then }) => {
  // Every score is written two days after the merge, as a nightly backfill would.
  const written = { time: "2026-01-12T00:00:00Z" };
  const runs = {
    "before-failed": [30, "2026-01-05T00:00:00Z"],
    "before-passed": [10, "2026-01-05T00:00:00Z"],
    "after-failed": [2, "2026-01-15T00:00:00Z"],
    "after-passed": [18, "2026-01-15T00:00:00Z"],
  } as const;
  await given(
    '"scores.jsonl" with scores of "research-skill-used" written at "2026-01-12T00:00:00Z": 30 failed of 40 runs that started before "2026-01-10T00:00:00Z" and 2 failed of 20 runs that started after it',
    async () => {
      const records = Object.entries(runs).flatMap(([prefix, [count]]) =>
        scores("research-skill-used", prefix, count, prefix.endsWith("failed"), written),
      );
      await sut.files.put("$INPUT/scores.jsonl", jsonl(records));
    },
  );

  await given('run records in "runs/" with the start of each of these 60 runs', async () => {
    const records = Object.entries(runs).flatMap(([prefix, [count, start]]) =>
      Array.from({ length: count }, (_, index) => runRecord(`${prefix}-${index + 1}`, { start })),
    );
    await sut.files.put("$INPUT/runs/runs.jsonl", jsonl(records));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z --runs runs scores.jsonl"',
    async () => {
      run = await sut.cli([
        "check",
        "--problem",
        "research-skill-used",
        "--merged-at",
        MERGED_AT,
        "--runs",
        "runs",
        "scores.jsonl",
      ]);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then(
    'the output says "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell"',
    async () => {
      expect(run.stdout).toContain(
        "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell",
      );
    },
  );
});
