import { scenario } from "@opensoftware/testkit";
import { lines, workflow } from "./documents.ts";
import { agent, factoryYaml, prompt } from "./factory.ts";

const FILE = "$OUTPUT/.github/workflows/issue-labeled-auto-implement.md";
const providers = ["harness:", '  codex: "^1"'];
const extra = ["mcp:", '  - "@modelcontextprotocol/server-filesystem@2025.8.21"'];

scenario("SCN-FSPEC-045", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" on "codex" uses the MCP server "@modelcontextprotocol/server-filesystem@2025.8.21"',
    async () => {
      await sut.files.put(
        "$INPUT/factory.yaml",
        factoryYaml({ providers, agents: agent("implement", extra, "codex") }),
      );
      await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
    },
  );

  await given('it has the automation "github.issue.labeled(auto-implement)"', async () => {
    const rest = ["automations:", "  - on: github.issue.labeled(auto-implement)"];
    const agents = agent("implement", extra, "codex");
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ providers, agents, rest }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --gh-aw"', async () => {
    run = await sut.cli(["render", "--gh-aw"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the workflow uses the engine "codex"', async () => {
    expect(workflow(await sut.files.read(FILE)).frontmatter).toContain("\nengine: codex\n");
  });

  await then('the workflow starts the MCP server "server-filesystem" with "npx" and allows all its tools', async () => {
    const { frontmatter } = workflow(await sut.files.read(FILE));
    expect(frontmatter).toContain(
      lines(`
        mcp-servers:
          server-filesystem:
            command: npx
            args:
              - -y
              - "@modelcontextprotocol/server-filesystem@2025.8.21"
            allowed:
              - "*"
      `),
    );
  });
});
