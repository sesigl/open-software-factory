import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

const SKILL = "---\nname: testing\ndescription: Write a system test.\n---\n\n# Testing\n";

scenario("SCN-FSPEC-011", async ({ sut, given, when, then }) => {
  let providers: string[] = [];
  await given('a factory.yaml that declares the harnesses "claude-code", "codex" and "opencode"', async () => {
    providers = ["harness:", '  claude-code: "^2"', '  codex: "^1"', '  opencode: "^1"'];
  });

  await given('its agent "implement" has the skill "skills/testing"', async () => {
    const extra = ["skills: [./skills/testing]", "mcp:", '  - "@modelcontextprotocol/server-filesystem@2025.8.21"'];
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ providers, agents: agent("implement", extra) }));
    await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
    await sut.files.put("$INPUT/skills/testing/SKILL.md", SKILL);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --harness all"', async () => {
    run = await sut.cli(["render", "--harness", "all"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '".claude/skills/testing/SKILL.md", ".agents/skills/testing/SKILL.md" and ".opencode/skills/testing/SKILL.md" in the output folder are the skill\'s SKILL.md',
    async () => {
      for (const folder of [".claude", ".agents", ".opencode"]) {
        expect(await sut.files.read(`$OUTPUT/${folder}/skills/testing/SKILL.md`)).toBe(SKILL);
      }
    },
  );

  await then('"CLAUDE.md" in the output folder is "@AGENTS.md"', async () => {
    expect(await sut.files.read("$OUTPUT/CLAUDE.md")).toBe("@AGENTS.md\n");
  });

  await then(
    '"opencode.json" in the output folder starts the server "server-filesystem" as a local command',
    async () => {
      const config = JSON.parse(await sut.files.read("$OUTPUT/opencode.json"));
      expect(config.mcp["server-filesystem"]).toEqual({
        type: "local",
        command: ["npx", "-y", "@modelcontextprotocol/server-filesystem@2025.8.21"],
        enabled: true,
      });
    },
  );
});
