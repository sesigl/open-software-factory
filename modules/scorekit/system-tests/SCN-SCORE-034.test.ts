import { scenario } from "@opensoftware/testkit";
import { entryOf, readEntries } from "./evaluators.ts";
import { scorerFile } from "./runs.ts";

scenario("SCN-SCORE-034", async ({ sut, given, when, then }) => {
  await given(
    'the scorer file "scorers/slow-tests.md" with the pass criterion "No test waits longer than one second." and the prompt "Look for sleep calls."',
    async () => {
      await sut.files.put(
        "$INPUT/scorers/slow-tests.md",
        scorerFile({ pass: "No test waits longer than one second." }, "Look for sleep calls."),
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit export --scorer scorers/slow-tests.md"', async () => {
    run = await sut.cli(["export", "--scorer", "scorers/slow-tests.md"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the evaluator "slow-tests" has a system message with "Look for sleep calls." and "Pass criterion: No test waits longer than one second."',
    async () => {
      const { evaluator } = entryOf(await readEntries(sut), "slow-tests");
      const [system] = evaluator.prompt;
      expect(system?.role).toBe("system");
      expect(system?.content).toContain("Look for sleep calls.");
      expect(system?.content).toContain("Pass criterion: No test waits longer than one second.");
    },
  );

  await then('the evaluator "slow-tests" has a user message with the variables "input" and "output"', async () => {
    const { evaluator } = entryOf(await readEntries(sut), "slow-tests");
    const user = evaluator.prompt[1];
    expect(user?.role).toBe("user");
    expect(user?.content).toContain("{{input}}");
    expect(user?.content).toContain("{{output}}");
  });

  await then(
    'the evaluator "slow-tests" maps "input" to the source "input" and "output" to the source "output"',
    async () => {
      const { evaluator } = entryOf(await readEntries(sut), "slow-tests");
      expect(evaluator.variableMapping).toEqual([
        { variable: "input", source: "input" },
        { variable: "output", source: "output" },
      ]);
    },
  );

  await then(
    'the evaluator "slow-tests" has the output type "BOOLEAN" with "No test waits longer than one second." in its value instructions',
    async () => {
      const { evaluator } = entryOf(await readEntries(sut), "slow-tests");
      expect(evaluator.outputDefinition.dataType).toBe("BOOLEAN");
      expect(evaluator.outputDefinition.scoreValueInstructions).toContain("No test waits longer than one second.");
    },
  );
});
