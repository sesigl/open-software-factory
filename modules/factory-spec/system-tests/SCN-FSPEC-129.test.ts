import { scenario } from "@opensoftware/testkit";
import { factoryYaml, prompt } from "./factory.ts";

const TRIAGE = ["harness: claude-code", "model: routes/triage", "prompt: ./agents/triage.md", "effort: medium"];

scenario<"entry" | "line" | "column" | "says">("SCN-FSPEC-129", async ({ sut, given, when, then, example }) => {
  await given(
    'a factory.yaml that declares the harness "claude-code", the secrets provider "openbao" and the agent "triage" with its prompt',
    async () => {
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  await given('the agent "triage" has "<entry>" on line <line>', async () => {
    // The entry takes the place of the line with its key, or comes before the effort.
    const key = TRIAGE.findIndex((line) => line.startsWith(`${example.entry.split(":")[0]}:`));
    const entries = key >= 0 ? TRIAGE.with(key, example.entry) : TRIAGE.toSpliced(3, 0, example.entry);
    const yaml = factoryYaml({
      providers: ["harness:", '  claude-code: "^2"', "secrets:", '  openbao: "^1"'],
      agents: ["triage:", ...entries.map((line) => `  ${line}`)],
    });
    expect(yaml.split("\n")[Number(example.line) - 1]).toBe(`    ${example.entry}`);
    await sut.files.put("$INPUT/factory.yaml", yaml);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output names "factory.yaml:<line>:<column>" and says "<says>"', async () => {
    const at = `factory.yaml:${example.line}:${example.column} `;
    expect(
      run.stdout.split("\n").find((line) => line.startsWith(at)),
      run.stdout,
    ).toContain(example.says);
  });
});
