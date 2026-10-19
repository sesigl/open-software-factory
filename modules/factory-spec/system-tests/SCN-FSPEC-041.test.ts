import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-041", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" uses the MCP server "@modelcontextprotocol/server-filesystem@2025.8.21" and has the automation on "github.issue.labeled(auto-implement)"',
    async () => {
      const agents = agent("implement", ["mcp:", '  - "@modelcontextprotocol/server-filesystem@2025.8.21"']);
      const rest = ["automations:", "  - on: github.issue.labeled(auto-implement)"];
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents, rest }));
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
    '".github/workflows/issue-labeled-auto-implement.md" in the output folder has the MCP server "server-filesystem" with the command "npx" and the arguments "-y" and "@modelcontextprotocol/server-filesystem@2025.8.21"',
    async () => {
      expect(await sut.files.read("$OUTPUT/.github/workflows/issue-labeled-auto-implement.md")).toContain(
        'mcp-servers:\n  server-filesystem:\n    command: npx\n    args:\n      - -y\n      - "@modelcontextprotocol/server-filesystem@2025.8.21"\n',
      );
    },
  );
});
