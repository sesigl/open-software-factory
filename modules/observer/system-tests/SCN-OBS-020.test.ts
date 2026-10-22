import { scenario } from "@opensoftware/testkit";
import { aroundMerge } from "./scores.ts";

scenario("SCN-OBS-020", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 2 of 20 runs after it',
    async () => {
      await sut.files.put("$INPUT/scores.jsonl", aroundMerge(30, 40, 2, 20));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z scores.jsonl"',
    async () => {
      run = await sut.cli([
        "check",
        "--problem",
        "research-skill-used",
        "--merged-at",
        "2026-01-10T00:00:00Z",
        "scores.jsonl",
      ]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the output says "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell"',
    async () => {
      expect(run.stdout).toContain(
        "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell",
      );
    },
  );

  await then('"$OUTPUT/check.json" has the verdict "fell"', async () => {
    const check = JSON.parse(await sut.files.read("$OUTPUT/check.json"));
    expect(check).toMatchObject({
      problem: "research-skill-used",
      mergedAt: "2026-01-10T00:00:00.000Z",
      minRuns: 20,
      before: { runs: 40, failures: 30, failureRate: 0.75 },
      after: { runs: 20, failures: 2, failureRate: 0.1 },
      verdict: "fell",
    });
    expect(check.pValue).toBeLessThan(0.0001);
  });
});
