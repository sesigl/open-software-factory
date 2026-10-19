import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";
import { lines } from "./k8s.ts";

scenario("SCN-FSPEC-035", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" uses the MCP server "@modelcontextprotocol/server-filesystem@2025.8.21"',
    async () => {
      const yaml = factoryYaml({
        agents: agent("triage", ["mcp:", '  - "@modelcontextprotocol/server-filesystem@2025.8.21"']),
      });
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --k8s"', async () => {
    run = await sut.cli(["render", "--k8s"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"k8s/mcpserver-server-filesystem.yaml" in the output folder is an MCPServer that runs "npx -y @modelcontextprotocol/server-filesystem@2025.8.21" over stdio',
    async () => {
      const text = await sut.files.read("$OUTPUT/k8s/mcpserver-server-filesystem.yaml");
      expect(lines(text)).toEqual(
        expect.arrayContaining(["kind: MCPServer", "    cmd: npx", "  transportType: stdio", "  stdioTransport: {}"]),
      );
      expect(text).toContain('    args:\n      - -y\n      - "@modelcontextprotocol/server-filesystem@2025.8.21"\n');
    },
  );

  await then('the Agent "triage" has the tool "MCPServer" named "server-filesystem"', async () => {
    const text = await sut.files.read("$OUTPUT/k8s/agent-triage.yaml");
    expect(text).toContain(
      "      - type: McpServer\n        mcpServer:\n          apiGroup: kagent.dev\n          kind: MCPServer\n          name: server-filesystem\n",
    );
  });
});
