import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-009", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" uses the harness "codex" on line 8', async () => {
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  await given('providers.harness declares only "claude-code"', async () => {
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage", [], "codex") }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render"', async () => {
    run = await sut.cli(["render"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "harness \\"codex\\" is not declared under providers.harness"', async () => {
    expect(run.stderr).toContain('harness "codex" is not declared under providers.harness');
  });

  await then("the output folder is empty", async () => {
    expect(await sut.files.list("$OUTPUT")).toEqual([]);
  });
});
