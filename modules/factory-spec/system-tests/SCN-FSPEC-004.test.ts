import { scenario } from "@opensoftware/testkit";
import { factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-004", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the field "modle" on line 9', async () => {
    const agents = ["triage:", "  harness: claude-code", "  modle: routes/triage", "  prompt: ./agents/triage.md"];
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents }));
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "factory.yaml:9:5 /agents/triage/modle: unknown field"', async () => {
    expect(run.stdout).toContain("factory.yaml:9:5 /agents/triage/modle: unknown field");
  });
});
