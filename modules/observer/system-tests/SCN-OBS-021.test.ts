import { scenario } from "@opensoftware/testkit";
import { aroundMerge, MERGED_AT } from "./scores.ts";

scenario("SCN-OBS-021", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 0 of 5 runs after it',
    async () => {
      await sut.files.put("$INPUT/scores.jsonl", aroundMerge(30, 40, 0, 5));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z scores.jsonl"',
    async () => {
      run = await sut.cli(["check", "--problem", "research-skill-used", "--merged-at", MERGED_AT, "scores.jsonl"]);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then(
    'the output says "research-skill-used: 75.0% before (30 of 40 runs), 0.0% after (0 of 5 runs): not enough runs"',
    async () => {
      expect(run.stdout).toContain(
        "research-skill-used: 75.0% before (30 of 40 runs), 0.0% after (0 of 5 runs): not enough runs",
      );
    },
  );

  await then('"$OUTPUT/check.json" has the verdict "not enough runs"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/check.json"))).toMatchObject({ verdict: "not enough runs" });
  });
});
