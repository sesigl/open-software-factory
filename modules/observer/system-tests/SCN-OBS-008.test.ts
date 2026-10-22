import { scenario } from "@opensoftware/testkit";
import { jsonl, problemsOf, scores } from "./scores.ts";

scenario("SCN-OBS-008", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" with 2 failed scores of "scope-creep" and 3 failed scores of "research-skill-used"',
    async () => {
      const records = [...scores("scope-creep", "run", 2, true), ...scores("research-skill-used", "run", 3, true)];
      await sut.files.put("$INPUT/scores.jsonl", jsonl(records));
    },
  );

  await when('the user runs "observer analyze --min-failures 2 scores.jsonl"', async () => {
    const run = await sut.cli(["analyze", "--min-failures", "2", "scores.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"$OUTPUT/problems.json" has the problems "research-skill-used" and "scope-creep", in this order',
    async () => {
      const problems = problemsOf(await sut.files.read("$OUTPUT/problems.json"));
      expect(problems.map((problem) => problem.id)).toEqual(["research-skill-used", "scope-creep"]);
    },
  );
});
