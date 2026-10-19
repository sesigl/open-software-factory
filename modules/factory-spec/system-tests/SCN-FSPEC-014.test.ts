import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-014", async ({ sut, given, when, then }) => {
  await given('a factory.yaml with the agents "triage" and "implement"', async () => {
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: [...agent("triage"), ...agent("implement")] }));
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --agent triage"', async () => {
    run = await sut.cli(["render", "--agent", "triage"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"AGENTS.md" in the output folder is the prompt of "triage"', async () => {
    expect(await sut.files.read("$OUTPUT/AGENTS.md")).toBe(prompt("triage"));
  });
});
