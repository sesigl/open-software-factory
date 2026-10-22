import { scenario } from "@opensoftware/testkit";
import { aroundMerge, MERGED_AT } from "./scores.ts";

scenario("SCN-OBS-022", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 0 of 5 runs after it',
    async () => {
      await sut.files.put("$INPUT/scores.jsonl", aroundMerge(30, 40, 0, 5));
    },
  );

  await when(
    'the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z --min-runs 5 scores.jsonl"',
    async () => {
      const run = await sut.cli([
        "check",
        "--problem",
        "research-skill-used",
        "--merged-at",
        MERGED_AT,
        "--min-runs",
        "5",
        "scores.jsonl",
      ]);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then('"$OUTPUT/check.json" has the verdict "fell"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/check.json"))).toMatchObject({ verdict: "fell" });
  });
});
