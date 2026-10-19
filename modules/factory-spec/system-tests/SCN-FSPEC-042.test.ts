import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-042", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" uses the harness "opencode" and has the automation on "github.issue.labeled(auto-implement)"',
    async () => {
      const yaml = factoryYaml({
        providers: ["harness:", '  opencode: "^1"'],
        agents: agent("implement", [], "opencode"),
        rest: ["automations:", "  - on: github.issue.labeled(auto-implement)"],
      });
      await sut.files.put("$INPUT/factory.yaml", yaml);
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

  await then('the error output contains "gh-aw cannot run the harness \\"opencode\\""', async () => {
    expect(run.stderr).toContain('gh-aw cannot run the harness "opencode"');
  });
});
