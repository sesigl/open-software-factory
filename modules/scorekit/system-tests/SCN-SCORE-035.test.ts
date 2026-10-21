import { scenario } from "@opensoftware/testkit";
import { entryOf, readEntries } from "./evaluators.ts";
import { scorerFile } from "./runs.ts";

scenario("SCN-SCORE-035", async ({ sut, given, when, then }) => {
  await given('the scorer file "scorers/slow-tests.md" with the sampling rate 0.2', async () => {
    await sut.files.put("$INPUT/scorers/slow-tests.md", scorerFile({ sample: 0.2 }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit export --scorer scorers/slow-tests.md"', async () => {
    run = await sut.cli(["export", "--scorer", "scorers/slow-tests.md"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the rule of "slow-tests" is named "scorekit slow-tests" with the sampling 0.2', async () => {
    const { rule } = entryOf(await readEntries(sut), "slow-tests");
    expect(rule.name).toBe("scorekit slow-tests");
    expect(rule.sampling).toBe(0.2);
  });

  await then('the rule of "slow-tests" filters the observation name "invoke_agent"', async () => {
    const { rule } = entryOf(await readEntries(sut), "slow-tests");
    expect(rule.filter).toEqual([
      { type: "stringOptions", column: "name", operator: "any of", value: ["invoke_agent"] },
    ]);
  });

  await then('the rule of "slow-tests" is disabled', async () => {
    const { rule } = entryOf(await readEntries(sut), "slow-tests");
    expect(rule.enabled).toBe(false);
  });
});
