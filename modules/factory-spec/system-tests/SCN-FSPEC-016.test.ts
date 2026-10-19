import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt, registryVersions, versionsPath } from "./factory.ts";

scenario("SCN-FSPEC-016", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"',
    async () => {
      const yaml = factoryYaml({ agents: agent("triage", ["mcp: [registry:io.github.acme/tracker@1.4]"]) });
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  let registry: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'the MCP Registry lists the versions "1.3.0", "1.4.0", "1.4.2" and "2.0.0" of "io.github.acme/tracker"',
    async () => {
      const body = registryVersions("io.github.acme/tracker", ["1.3.0", "1.4.0", "1.4.2", "2.0.0"]);
      registry = await fakes.http([{ path: versionsPath("io.github.acme/tracker"), body }]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"], { env: { FACTORY_MCP_REGISTRY: registry.url } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"factory.lock" pins "registry:io.github.acme/tracker@1.4" to the version "1.4.2" and the npm package "@acme/tracker-mcp@1.4.2"',
    async () => {
      const lock = JSON.parse(await sut.files.read("$INPUT/factory.lock"));
      expect(lock.mcp["registry:io.github.acme/tracker@1.4"]).toEqual({
        name: "io.github.acme/tracker",
        version: "1.4.2",
        package: { registryType: "npm", identifier: "@acme/tracker-mcp", version: "1.4.2" },
      });
    },
  );
});
