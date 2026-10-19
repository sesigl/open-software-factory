import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";
import { lines } from "./k8s.ts";

scenario("SCN-FSPEC-036", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"',
    async () => {
      const yaml = factoryYaml({ agents: agent("triage", ["mcp: [registry:io.github.acme/tracker@1.4]"]) });
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  await given('factory.lock pins it to the remote URL "https://tracker.example.com/mcp"', async () => {
    const entry = {
      name: "io.github.acme/tracker",
      version: "1.4.2",
      remote: { type: "streamable-http", url: "https://tracker.example.com/mcp" },
    };
    const lock = { version: 1, mcp: { "registry:io.github.acme/tracker@1.4": entry } };
    await sut.files.put("$INPUT/factory.lock", `${JSON.stringify(lock, null, 2)}\n`);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --k8s"', async () => {
    run = await sut.cli(["render", "--k8s"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"k8s/remotemcpserver-tracker.yaml" in the output folder is a RemoteMCPServer with the URL "https://tracker.example.com/mcp" and the protocol "STREAMABLE_HTTP"',
    async () => {
      const text = lines(await sut.files.read("$OUTPUT/k8s/remotemcpserver-tracker.yaml"));
      expect(text).toEqual(
        expect.arrayContaining([
          "kind: RemoteMCPServer",
          "  url: https://tracker.example.com/mcp",
          "  protocol: STREAMABLE_HTTP",
        ]),
      );
    },
  );

  await then('the Agent "triage" has the tool "RemoteMCPServer" named "tracker"', async () => {
    const text = await sut.files.read("$OUTPUT/k8s/agent-triage.yaml");
    expect(text).toContain("          kind: RemoteMCPServer\n          name: tracker\n");
  });
});
