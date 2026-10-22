import { scenario } from "@opensoftware/testkit";
import { jsonl, scores } from "./scores.ts";

scenario("SCN-OBS-012", async ({ sut, given, when, then }) => {
  await given('"scores.jsonl" with 30 failed and 10 passed scores of the scorer "research-skill-used"', async () => {
    const records = [
      ...scores("research-skill-used", "failed", 30, true),
      ...scores("research-skill-used", "passed", 10, false),
    ];
    await sut.files.put("$INPUT/scores.jsonl", jsonl(records));
  });

  await when('the user runs "observer analyze --markdown problems.md scores.jsonl"', async () => {
    const run = await sut.cli(["analyze", "--markdown", "problems.md", "scores.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"problems.md" has the row "| research-skill-used | 30 | 40 | 75.0% | Investigated inline. |"',
    async () => {
      const lines = (await sut.files.read("$INPUT/problems.md")).split("\n");
      expect(lines).toContain("| Problem | Failures | Scored runs | Failure rate | Top reason |");
      expect(lines).toContain("| research-skill-used | 30 | 40 | 75.0% | Investigated inline. |");
    },
  );
});
