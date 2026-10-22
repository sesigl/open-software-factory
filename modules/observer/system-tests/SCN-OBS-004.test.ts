import { scenario } from "@opensoftware/testkit";
import { jsonl, problemsOf, scores } from "./scores.ts";

scenario("SCN-OBS-004", async ({ sut, given, when, then }) => {
  await given('"scores.jsonl" with 30 failed and 10 passed scores of the scorer "research-skill-used"', async () => {
    const records = [
      ...scores("research-skill-used", "failed", 30, true),
      ...scores("research-skill-used", "passed", 10, false),
    ];
    await sut.files.put("$INPUT/scores.jsonl", jsonl(records));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "observer analyze scores.jsonl"', async () => {
    run = await sut.cli(["analyze", "scores.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"$OUTPUT/problems.json" has one problem "research-skill-used" with 30 failures in 40 scored runs',
    async () => {
      const problems = problemsOf(await sut.files.read("$OUTPUT/problems.json"));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatchObject({ id: "research-skill-used", failures: 30, scored: 40, failureRate: 0.75 });
      expect(problems[0]?.runs).toHaveLength(30);
      expect(problems[0]?.runs[0]).toMatchObject({ run: "failed-1", reason: "Investigated inline." });
    },
  );

  await then('the output says "research-skill-used: failed 30 of 40 runs (75.0%)"', async () => {
    expect(run.stdout).toContain("research-skill-used: failed 30 of 40 runs (75.0%)");
    expect(run.stdout).toMatch(/^wrote .*problems\.json$/m);
  });
});
