import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt, TRACKER_LOCK } from "./factory.ts";

scenario("SCN-FSPEC-017", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"',
    async () => {
      const yaml = factoryYaml({ agents: agent("triage", ["mcp: [registry:io.github.acme/tracker@1.4]"]) });
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  await given('factory.lock pins it to the version "1.4.2"', async () => {
    await sut.files.put("$INPUT/factory.lock", TRACKER_LOCK);
  });

  let registry: Awaited<ReturnType<typeof fakes.http>>;
  await given("the MCP Registry answers no request", async () => {
    registry = await fakes.http([]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"], { env: { FACTORY_MCP_REGISTRY: registry.url } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"factory.lock" still pins "registry:io.github.acme/tracker@1.4" to the version "1.4.2"', async () => {
    const lock = JSON.parse(await sut.files.read("$INPUT/factory.lock"));
    expect(lock.mcp["registry:io.github.acme/tracker@1.4"].version).toBe("1.4.2");
  });
});
