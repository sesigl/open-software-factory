import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt, TRACKER_LOCK } from "./factory.ts";

scenario("SCN-FSPEC-018", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"',
    async () => {
      const yaml = factoryYaml({ agents: agent("triage", ["mcp: [registry:io.github.acme/tracker@1.4]"]) });
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  await given('factory.lock pins it to the npm package "@acme/tracker-mcp@1.4.2"', async () => {
    await sut.files.put("$INPUT/factory.lock", TRACKER_LOCK);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render"', async () => {
    run = await sut.cli(["render"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '".mcp.json" in the output folder starts the server "tracker" with the arguments "-y" and "@acme/tracker-mcp@1.4.2"',
    async () => {
      const config = JSON.parse(await sut.files.read("$OUTPUT/.mcp.json"));
      expect(config.mcpServers.tracker).toEqual({ command: "npx", args: ["-y", "@acme/tracker-mcp@1.4.2"] });
    },
  );
});
