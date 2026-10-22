import { scenario } from "@opensoftware/testkit";
import { jsonl, problemsOf, scores } from "./scores.ts";

scenario("SCN-OBS-010", async ({ sut, given, when, then }) => {
  await given('"scores.jsonl" with 1 failed and 5 passed scores of the scorer "research-skill-used"', async () => {
    const records = [
      ...scores("research-skill-used", "failed", 1, true),
      ...scores("research-skill-used", "passed", 5, false),
    ];
    await sut.files.put("$INPUT/scores.jsonl", jsonl(records));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "observer analyze scores.jsonl"', async () => {
    run = await sut.cli(["analyze", "scores.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"$OUTPUT/problems.json" has no problem', async () => {
    expect(problemsOf(await sut.files.read("$OUTPUT/problems.json"))).toEqual([]);
  });

  await then('the output says "no problems: no scorer failed 3 runs or more"', async () => {
    expect(run.stdout).toContain("no problems: no scorer failed 3 runs or more");
  });
});
