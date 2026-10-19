import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-020", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"',
    async () => {
      const yaml = factoryYaml({ agents: agent("triage", ["mcp: [registry:io.github.acme/tracker@1.4]"]) });
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  await given("the working folder has no factory.lock", async () => {
    await sut.files.remove("$INPUT/factory.lock");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render"', async () => {
    run = await sut.cli(["render"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "factory.lock has no entry for \\"registry:io.github.acme/tracker@1.4\\": run \\"factory plan\\""',
    async () => {
      expect(run.stderr).toContain(
        'factory.lock has no entry for "registry:io.github.acme/tracker@1.4": run "factory plan"',
      );
    },
  );
});
