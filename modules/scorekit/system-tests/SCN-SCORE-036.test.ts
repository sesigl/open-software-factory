import { scenario } from "@opensoftware/testkit";
import { entryOf, readEntries } from "./evaluators.ts";

scenario("SCN-SCORE-036", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit export --scorer redundant-tests --provider anthropic --model claude-haiku-5-5"',
    async () => {
      run = await sut.cli([
        "export",
        "--scorer",
        "redundant-tests",
        "--provider",
        "anthropic",
        "--model",
        "claude-haiku-5-5",
      ]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the evaluator "redundant-tests" has the model "claude-haiku-5-5" of the provider "anthropic"',
    async () => {
      const { evaluator } = entryOf(await readEntries(sut), "redundant-tests");
      expect(evaluator.modelConfig).toEqual({ provider: "anthropic", model: "claude-haiku-5-5" });
    },
  );
});
