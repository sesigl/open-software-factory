import { scenario } from "@opensoftware/testkit";
import { lines, workflow } from "./documents.ts";
import { agent, factoryYaml, prompt } from "./factory.ts";

const FILE = "$OUTPUT/.github/workflows/issue-labeled-auto-implement.md";

scenario("SCN-FSPEC-043", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" on "claude-code" has the automation "github.issue.labeled(auto-implement)"',
    async () => {
      const rest = ["automations:", "  - on: github.issue.labeled(auto-implement)"];
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
    '".github/workflows/issue-labeled-auto-implement.md" in the output folder runs on issues with the type "labeled" and the label "auto-implement"',
    async () => {
      const { frontmatter } = workflow(await sut.files.read(FILE));
      expect(frontmatter).toContain(
        lines(`
          on:
            issues:
              types:
                - labeled
              names:
                - auto-implement
        `),
      );
    },
  );

  await then('the workflow uses the engine "claude" and the prompt of "implement"', async () => {
    const { frontmatter, body } = workflow(await sut.files.read(FILE));
    expect(frontmatter).toContain("\nengine: claude");
    expect(body).toBe(prompt("implement"));
  });
});
