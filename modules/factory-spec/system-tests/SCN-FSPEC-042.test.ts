import { scenario } from "@opensoftware/testkit";
import { lines, resource } from "./documents.ts";
import { agent, factoryYaml, prompt } from "./factory.ts";

const LOCK = `${JSON.stringify({
  version: 1,
  mcp: {
    "registry:io.github.acme/docs@2": {
      name: "io.github.acme/docs",
      version: "2.1.0",
      remote: { type: "streamable-http", url: "https://mcp.acme.example/docs" },
    },
  },
})}\n`;

scenario("SCN-FSPEC-042", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/docs@2"', async () => {
    await sut.files.put(
      "$INPUT/factory.yaml",
      factoryYaml({ agents: agent("triage", ["mcp: [registry:io.github.acme/docs@2]"]) }),
    );
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  await given('factory.lock pins it to the remote "https://mcp.acme.example/docs"', async () => {
    await sut.files.put("$INPUT/factory.lock", LOCK);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --k8s"', async () => {
    run = await sut.cli(["render", "--k8s"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"k8s/triage.yaml" in the output folder has a "RemoteMCPServer" "docs" at "https://mcp.acme.example/docs"',
    async () => {
      const found = resource(await sut.files.read("$OUTPUT/k8s/triage.yaml"), "RemoteMCPServer", "docs");
      expect(found).toContain("  protocol: STREAMABLE_HTTP\n  url: https://mcp.acme.example/docs\n");
    },
  );

  await then('the Agent "triage" uses the "RemoteMCPServer" "docs"', async () => {
    const found = resource(await sut.files.read("$OUTPUT/k8s/triage.yaml"), "Agent", "triage");
    expect(found).toContain(
      lines(
        `
        tools:
          - type: McpServer
            mcpServer:
              apiGroup: kagent.dev
              kind: RemoteMCPServer
              name: docs
      `,
        2,
      ),
    );
  });
});
