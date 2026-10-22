import { scenario } from "@opensoftware/testkit";
import { aroundMerge, MERGED_AT } from "./scores.ts";

scenario("SCN-OBS-024", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" where "research-skill-used" failed 2 of 20 runs before "2026-01-10T00:00:00Z" and 12 of 20 runs after it',
    async () => {
      await sut.files.put("$INPUT/scores.jsonl", aroundMerge(2, 20, 12, 20));
    },
  );

  await when(
    'the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z scores.jsonl"',
    async () => {
      const run = await sut.cli([
        "check",
        "--problem",
        "research-skill-used",
        "--merged-at",
        MERGED_AT,
        "scores.jsonl",
      ]);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then('"$OUTPUT/check.json" has the verdict "rose"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/check.json"))).toMatchObject({ verdict: "rose" });
  });
});
