import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-135", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has a stop check whose command is blank, on line 12', async () => {
    const yaml = factoryYaml({ agents: agent("triage", ["stopCheck:", '  command: "  "']) });
    expect(yaml.split("\n")[11]).toBe('      command: "  "');
    await sut.files.put("$INPUT/factory.yaml", yaml);
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output names "factory.yaml:12:7" and says "/agents/triage/stopCheck/command: must match pattern"',
    async () => {
      const line = run.stdout.split("\n").find((each) => each.startsWith("factory.yaml:12:7 "));
      expect(line, run.stdout).toContain("/agents/triage/stopCheck/command: must match pattern");
    },
  );
});
