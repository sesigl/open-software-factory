import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-022", async ({ sut, given, when, then }) => {
  await given('a factory.yaml of the factory "web-app" with the agent "triage"', async () => {
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage") }));
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  await given("the factory was never applied", async () => {
    expect(await sut.files.list("$OUTPUT")).toEqual([]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "+ factory: \\"web-app\\""', async () => {
    expect(run.stdout).toContain('+ factory: "web-app"');
  });

  await then('the output contains "Plan: 5 to add, 0 to change, 0 to remove, 0 drifted."', async () => {
    expect(run.stdout).toContain("Plan: 5 to add, 0 to change, 0 to remove, 0 drifted.");
  });
});
