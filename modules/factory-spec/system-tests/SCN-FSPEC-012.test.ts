import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-012", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "implement" has the skill "skills/testing"', async () => {
    await sut.files.put(
      "$INPUT/factory.yaml",
      factoryYaml({ agents: agent("implement", ["skills: [./skills/testing]"]) }),
    );
    await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
    await sut.files.put("$INPUT/skills/testing/SKILL.md", "# Testing\n");
  });

  await given('the factory engineer ran "factory render"', async () => {
    const first = await sut.cli(["render"]);
    expect(first.exitCode, first.stderr).toBe(0);
  });

  await given('the factory engineer removed the skill "skills/testing" from factory.yaml', async () => {
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("implement") }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render"', async () => {
    run = await sut.cli(["render"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output folder has no ".claude/skills/testing"', async () => {
    const files = await sut.files.list("$OUTPUT");
    expect(files).toContain("AGENTS.md");
    expect(files.filter((file) => file.startsWith(".claude/skills/"))).toEqual([]);
  });
});
