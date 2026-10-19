import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-010", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" uses the harness "codex" and the MCP server "@modelcontextprotocol/server-filesystem@2025.8.21"',
    async () => {
      const yaml = factoryYaml({
        providers: ["harness:", '  codex: "^1"'],
        agents: agent("implement", ["mcp:", '  - "@modelcontextprotocol/server-filesystem@2025.8.21"'], "codex"),
      });
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render"', async () => {
    run = await sut.cli(["render"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '".codex/config.toml" in the output folder has the section "[mcp_servers.\\"server-filesystem\\"]"',
    async () => {
      expect((await sut.files.read("$OUTPUT/.codex/config.toml")).split("\n")).toContain(
        '[mcp_servers."server-filesystem"]',
      );
    },
  );

  await then(
    '".codex/config.toml" in the output folder has the line "args = [\\"-y\\",\\"@modelcontextprotocol/server-filesystem@2025.8.21\\"]"',
    async () => {
      expect((await sut.files.read("$OUTPUT/.codex/config.toml")).split("\n")).toContain(
        'args = ["-y","@modelcontextprotocol/server-filesystem@2025.8.21"]',
      );
    },
  );

  await then('"AGENTS.md" in the output folder is the prompt of "implement"', async () => {
    expect(await sut.files.read("$OUTPUT/AGENTS.md")).toBe(prompt("implement"));
  });
});
