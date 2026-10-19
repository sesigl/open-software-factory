import { scenario } from "@opensoftware/testkit";
import { workflow } from "./documents.ts";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-044", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" on "claude-code" has the automation cron "0 10 * * *" that runs "self-triage-report"',
    async () => {
      const rest = ["automations:", '  - cron: "0 10 * * *"', "    run: self-triage-report"];
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("implement"), rest }));
      await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --gh-aw"', async () => {
    run = await sut.cli(["render", "--gh-aw"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '".github/workflows/self-triage-report.md" in the output folder runs on the schedule "0 10 * * *"',
    async () => {
      const { frontmatter } = workflow(await sut.files.read("$OUTPUT/.github/workflows/self-triage-report.md"));
      expect(frontmatter).toContain("on:\n  schedule:\n    - cron: 0 10 * * *\n");
    },
  );
});
