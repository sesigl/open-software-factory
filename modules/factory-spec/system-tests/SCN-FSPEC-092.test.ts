import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-092", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"',
    async () => {
      const yaml = factoryYaml({ agents: agent("triage", ["mcp: [registry:io.github.acme/tracker@1.4]"]) });
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  await given("the factory has no factory.lock", async () => {
    expect(await sut.files.list("$INPUT")).not.toContain("factory.lock");
  });

  let registry: Awaited<ReturnType<typeof fakes.http>>;
  await given("the MCP Registry answers no request", async () => {
    registry = await fakes.http([]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan --check"', async () => {
    run = await sut.cli(["plan", "--check"], { env: { FACTORY_MCP_REGISTRY: registry.url } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "factory.lock has no entry for \\"registry:io.github.acme/tracker@1.4\\": run \\"factory plan\\""',
    async () => {
      expect(run.stdout).toBe(
        'factory.lock has no entry for "registry:io.github.acme/tracker@1.4": run "factory plan"\n',
      );
    },
  );

  await then("the factory still has no factory.lock", async () => {
    expect(await sut.files.list("$INPUT")).not.toContain("factory.lock");
  });
});
