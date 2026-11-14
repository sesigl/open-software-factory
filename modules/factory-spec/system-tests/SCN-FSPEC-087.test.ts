import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

const PROBLEM =
  'factory.yaml does not pass "factory lint": factory.yaml:8:5 harness "codex" is not declared under providers.harness';

scenario("SCN-FSPEC-087", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" names the harness "codex", which providers.harness does not declare',
    async () => {
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage", [], "codex") }));
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-skill triage ./skills/review"', async () => {
    run = await sut.cli(["edit", "add-skill", "triage", "./skills/review"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the error is the one line "factory.yaml does not pass \\"factory lint\\": factory.yaml:8:5 harness \\"codex\\" is not declared under providers.harness"',
    async () => {
      expect(run.stderr).toBe(`${PROBLEM}\n`);
    },
  );
});
