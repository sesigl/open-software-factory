import { scenario } from "@opensoftware/testkit";
import { jsonl, problemsOf, score, scores } from "./scores.ts";

scenario("SCN-OBS-009", async ({ sut, given, when, then }) => {
  const records: unknown[] = [];
  await given(
    '"scores.jsonl" where the run "run-1" failed "research-skill-used" at "2026-01-01T00:00:00Z" and passed it at "2026-01-02T00:00:00Z"',
    async () => {
      // The later score comes first in the file: the time decides, not the order.
      records.push(score("research-skill-used", "run-1", false, { time: "2026-01-02T00:00:00Z" }));
      records.push(score("research-skill-used", "run-1", true, { time: "2026-01-01T00:00:00Z" }));
    },
  );

  await given('the runs "run-2", "run-3" and "run-4" failed "research-skill-used"', async () => {
    records.push(...scores("research-skill-used", "run", 4, true).slice(1));
    await sut.files.put("$INPUT/scores.jsonl", jsonl(records));
  });

  await when('the user runs "observer analyze scores.jsonl"', async () => {
    const run = await sut.cli(["analyze", "scores.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"$OUTPUT/problems.json" has one problem "research-skill-used" with 3 failures in 4 scored runs',
    async () => {
      const problems = problemsOf(await sut.files.read("$OUTPUT/problems.json"));
      expect(problems).toMatchObject([{ id: "research-skill-used", failures: 3, scored: 4 }]);
      expect(problems[0]?.runs.map((run) => run.run)).toEqual(["run-2", "run-3", "run-4"]);
    },
  );
});
