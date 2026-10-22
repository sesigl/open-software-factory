import { scenario } from "@opensoftware/testkit";
import { jsonl, problemsOf, scores } from "./scores.ts";

scenario("SCN-OBS-007", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" with 2 failed scores of "scope-creep" and 3 failed scores of "research-skill-used"',
    async () => {
      const records = [...scores("scope-creep", "run", 2, true), ...scores("research-skill-used", "run", 3, true)];
      await sut.files.put("$INPUT/scores.jsonl", jsonl(records));
    },
  );

  await when('the user runs "observer analyze scores.jsonl"', async () => {
    const run = await sut.cli(["analyze", "scores.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"$OUTPUT/problems.json" has only the problem "research-skill-used"', async () => {
    const problems = problemsOf(await sut.files.read("$OUTPUT/problems.json"));
    expect(problems.map((problem) => problem.id)).toEqual(["research-skill-used"]);
  });
});
