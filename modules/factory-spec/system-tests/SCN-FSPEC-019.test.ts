import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt, registryVersions, versionsPath } from "./factory.ts";

scenario("SCN-FSPEC-019", async ({ sut, fakes, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/docs@2"', async () => {
    const yaml = factoryYaml({
      providers: ["harness:", '  claude-code: "^2"', '  codex: "^1"', '  opencode: "^1"'],
      agents: agent("triage", ["mcp: [registry:io.github.acme/docs@2]"]),
    });
    await sut.files.put("$INPUT/factory.yaml", yaml);
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  let registry: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'the MCP Registry lists the version "2.1.0" of "io.github.acme/docs" with the remote "https://mcp.acme.example/docs"',
    async () => {
      const body = registryVersions("io.github.acme/docs", ["2.1.0"], "https://mcp.acme.example/docs");
      registry = await fakes.http([{ path: versionsPath("io.github.acme/docs"), body }]);
    },
  );

  await given('the factory engineer ran "factory plan"', async () => {
    const plan = await sut.cli(["plan"], { env: { FACTORY_MCP_REGISTRY: registry.url } });
    expect(plan.exitCode, plan.stderr).toBe(0);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --harness all"', async () => {
    run = await sut.cli(["render", "--harness", "all"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '".mcp.json" in the output folder connects the server "docs" to "https://mcp.acme.example/docs"',
    async () => {
      const config = JSON.parse(await sut.files.read("$OUTPUT/.mcp.json"));
      expect(config.mcpServers.docs).toEqual({ type: "http", url: "https://mcp.acme.example/docs" });
    },
  );

  await then(
    '".codex/config.toml" in the output folder has the line "url = \\"https://mcp.acme.example/docs\\""',
    async () => {
      expect((await sut.files.read("$OUTPUT/.codex/config.toml")).split("\n")).toContain(
        'url = "https://mcp.acme.example/docs"',
      );
    },
  );
});
