import { scenario } from "@opensoftware/testkit";
import { factoryYaml, prompt } from "./factory.ts";

const ALLOWED = 'factory.yaml:10:5 /agents/triage/effort: must be one of "low", "medium", "high", "xhigh", "max"';

scenario("SCN-FSPEC-058", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the effort "huge" on line 10', async () => {
    const agents = ["triage:", "  harness: claude-code", "  model: routes/triage", "  effort: huge"];
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: [...agents, "  prompt: ./agents/triage.md"] }));
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
    'the output contains "factory.yaml:10:5 /agents/triage/effort: must be one of \\"low\\", \\"medium\\", \\"high\\", \\"xhigh\\", \\"max\\""',
    async () => {
      expect(run.stdout).toContain(ALLOWED);
    },
  );
});
