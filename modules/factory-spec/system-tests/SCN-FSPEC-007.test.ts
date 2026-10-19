import { scenario } from "@opensoftware/testkit";
import { factoryYaml } from "./factory.ts";

scenario("SCN-FSPEC-007", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the prompt "agents/missing.md" on line 10', async () => {
    const agents = ["triage:", "  harness: claude-code", "  model: routes/triage", "  prompt: agents/missing.md"];
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents }));
  });

  await given('the working folder has no file "agents/missing.md"', async () => {
    await sut.files.remove("$INPUT/agents/missing.md");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "factory.yaml:10:5 the file \\"agents/missing.md\\" does not exist"', async () => {
    expect(run.stdout).toContain('factory.yaml:10:5 the file "agents/missing.md" does not exist');
  });
});
