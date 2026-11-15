import { scenario } from "@opensoftware/testkit";
import { factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-117", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has no model and no effort', async () => {
    const triage = ["triage:", "  harness: claude-code", "  prompt: ./agents/triage.md", "  skills: [./skills/notes]"];
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: triage }));
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory skills"', async () => {
    run = await sut.cli(["skills"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error is "factory.yaml:7:3 /agents/triage/model: missing required field" and "factory.yaml:7:3 /agents/triage/effort: missing required field"',
    async () => {
      expect(run.stderr).toBe(
        "factory.yaml:7:3 /agents/triage/model: missing required field\nfactory.yaml:7:3 /agents/triage/effort: missing required field\n",
      );
    },
  );

  await then("the output is empty", async () => {
    expect(run.stdout).toBe("");
  });
});
