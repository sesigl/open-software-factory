import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-046", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" on "opencode" has the automation "github.issue.labeled(auto-implement)"',
    async () => {
      const providers = ["harness:", '  opencode: "^1"'];
      const rest = ["automations:", "  - on: github.issue.labeled(auto-implement)"];
      const agents = agent("implement", [], "opencode");
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ providers, agents, rest }));
      await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --gh-aw"', async () => {
    run = await sut.cli(["render", "--gh-aw"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "gh-aw has no engine for the harness \\"opencode\\"; it runs claude-code, codex"',
    async () => {
      expect(run.stdout + run.stderr).toContain(
        'gh-aw has no engine for the harness "opencode"; it runs claude-code, codex',
      );
    },
  );
});
