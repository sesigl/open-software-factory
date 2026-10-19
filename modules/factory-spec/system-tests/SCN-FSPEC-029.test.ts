import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-029", async ({ sut, given, when, then }) => {
  await given('factory.yaml with the model "routes/triage" is committed', async () => {
    const yaml = factoryYaml({ agents: agent("triage"), rest: ["description: The web app factory."] });
    await sut.files.put("$INPUT/factory.yaml", yaml);
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    await sut.git.commit("factory v1");
  });

  await given(
    'the working copy sets the model to "routes/fast", adds the agent "review" and removes the description',
    async () => {
      const agents = [...agent("triage", [], "claude-code", "routes/fast"), ...agent("review")];
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents }));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory diff HEAD:factory.yaml"', async () => {
    run = await sut.cli(["diff", "HEAD:factory.yaml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "~ agents.triage.model: \\"routes/triage\\" -> \\"routes/fast\\""', async () => {
    expect(run.stdout).toContain('~ agents.triage.model: "routes/triage" -> "routes/fast"');
  });

  await then('the output contains "+ agents.review:"', async () => {
    expect(run.stdout).toContain("+ agents.review:");
  });

  await then('the output contains "- description:"', async () => {
    expect(run.stdout).toContain("- description:");
  });
});
