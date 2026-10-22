import { scenario } from "@opensoftware/testkit";
import { jsonl, problemsOf, scores } from "./scores.ts";

scenario("SCN-OBS-006", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" with 2 failed scores of "research-skill-used" with the reason "No skill call." and 3 with the reason "Investigated inline."',
    async () => {
      const records = [
        ...scores("research-skill-used", "none", 2, true, { reason: "No skill call." }),
        ...scores("research-skill-used", "inline", 3, true, { reason: "  Investigated inline. " }),
      ];
      await sut.files.put("$INPUT/scores.jsonl", jsonl(records));
    },
  );

  await when('the user runs "observer analyze scores.jsonl"', async () => {
    const run = await sut.cli(["analyze", "scores.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the problem "research-skill-used" has the reasons "Investigated inline." 3 times and "No skill call." 2 times, in this order',
    async () => {
      const [problem] = problemsOf(await sut.files.read("$OUTPUT/problems.json"));
      expect(problem?.reasons).toEqual([
        { reason: "Investigated inline.", count: 3 },
        { reason: "No skill call.", count: 2 },
      ]);
    },
  );
});
