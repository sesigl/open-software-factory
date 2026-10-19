import { scenario } from "@opensoftware/testkit";
import { lines, resource } from "./documents.ts";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-041", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" uses the MCP server "@modelcontextprotocol/server-filesystem@2025.8.21"',
    async () => {
      const extra = ["mcp:", '  - "@modelcontextprotocol/server-filesystem@2025.8.21"'];
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage", extra) }));
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
    '"k8s/triage.yaml" in the output folder has an "MCPServer" "server-filesystem" that runs "npx" with "-y" and "@modelcontextprotocol/server-filesystem@2025.8.21"',
    async () => {
      const found = resource(await sut.files.read("$OUTPUT/k8s/triage.yaml"), "MCPServer", "server-filesystem");
      expect(found).toContain(
        lines(
          `
          deployment:
            cmd: npx
            args:
              - -y
              - "@modelcontextprotocol/server-filesystem@2025.8.21"
        `,
          1,
        ),
      );
      expect(found).toContain("  transportType: stdio\n");
    },
  );

  await then('the Agent "triage" uses the "MCPServer" "server-filesystem"', async () => {
    const found = resource(await sut.files.read("$OUTPUT/k8s/triage.yaml"), "Agent", "triage");
    expect(found).toContain(
      lines(
        `
        tools:
          - type: McpServer
            mcpServer:
              apiGroup: kagent.dev
              kind: MCPServer
              name: server-filesystem
      `,
        2,
      ),
    );
  });
});
