import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-015", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" uses the declared harness "warp"', async () => {
    const yaml = factoryYaml({ providers: ["harness:", '  warp: "^1"'], agents: agent("triage", [], "warp") });
    await sut.files.put("$INPUT/factory.yaml", yaml);
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render"', async () => {
    run = await sut.cli(["render"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "factory render cannot write files for the harness \\"warp\\"; it writes claude-code, codex, opencode"',
    async () => {
      expect(run.stderr).toContain(
        'factory render cannot write files for the harness "warp"; it writes claude-code, codex, opencode',
      );
    },
  );
});
