import { scenario } from "@opensoftware/testkit";
import { prompt } from "./factory.ts";
import { AGENTS, reworkFactory } from "./rework.ts";

scenario<"stage" | "entry" | "line" | "says">("SCN-FSPEC-131", async ({ sut, given, when, then, example }) => {
  await given(
    'a factory.yaml with the stages "plan", "implement", "verify" with "wait: true" and the checks ["verify"], and "ship" with the checks ["verify"]',
    async () => {
      for (const name of AGENTS) await sut.files.put(`$INPUT/agents/${name}.md`, prompt(name));
    },
  );

  await given('the stage "<stage>" has "<entry>" on line <line>', async () => {
    const lines = reworkFactory(example.stage, example.entry).split("\n");
    expect(lines[Number(example.line) - 2]).toBe(`  - stage: ${example.stage}`);
    expect(lines[Number(example.line) - 1]).toBe(`    ${example.entry}`);
    await sut.files.put("$INPUT/factory.yaml", lines.join("\n"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output names "factory.yaml:<line>:5" and says "<says>"', async () => {
    // The factory's one problem: its line names the place and says what is wrong.
    expect(run.stdout.trimEnd().split("\n"), run.stdout).toEqual([
      `factory.yaml:${example.line}:5 ${example.says}`,
      "factory.yaml: 1 problems",
    ]);
  });
});
