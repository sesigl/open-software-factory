import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-008", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose workflow has the stage "review" on line 13 and no agent "review"', async () => {
    const rest = ["workflow:", "  - stage: triage", "  - stage: review"];
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage"), rest }));
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
    'the output contains "factory.yaml:13:5 stage \\"review\\" runs the agent \\"review\\", which agents does not declare"',
    async () => {
      expect(run.stdout).toContain(
        'factory.yaml:13:5 stage "review" runs the agent "review", which agents does not declare',
      );
    },
  );
});
