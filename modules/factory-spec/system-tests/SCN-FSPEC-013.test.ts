import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-013", async ({ sut, given, when, then }) => {
  await given('a factory.yaml with the agents "triage" and "implement"', async () => {
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: [...agent("triage"), ...agent("implement")] }));
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render"', async () => {
    run = await sut.cli(["render"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "factory.yaml declares 2 agents: choose one with --agent triage|implement"',
    async () => {
      expect(run.stderr).toContain("factory.yaml declares 2 agents: choose one with --agent triage|implement");
    },
  );
});
