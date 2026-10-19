import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";
import { lines } from "./k8s.ts";

scenario("SCN-FSPEC-039", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" uses the harness "claude-code" and has the automation on "github.issue.labeled(auto-implement)"',
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

  const file = "$OUTPUT/.github/workflows/issue-labeled-auto-implement.md";
  await then(
    '".github/workflows/issue-labeled-auto-implement.md" in the output folder starts on "issues" with the types "labeled" and the names "auto-implement"',
    async () => {
      expect(await sut.files.read(file)).toContain(
        "on:\n  issues:\n    types:\n      - labeled\n    names:\n      - auto-implement\n",
      );
    },
  );

  await then('its engine is "claude"', async () => {
    expect(lines(await sut.files.read(file))).toContain("engine: claude");
  });

  await then('its body is the prompt of "implement"', async () => {
    expect((await sut.files.read(file)).split("\n---\n\n")[1]).toBe(prompt("implement"));
  });
});
