import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, packument, packumentPath, prompt } from "./factory.ts";

scenario("SCN-FSPEC-069", async ({ sut, fakes, given, when, then }) => {
  await given('a factory.yaml with "claude-code" at "^4" under "providers.harness"', async () => {
    const providers = ["harness:", '  claude-code: "^4"'];
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ providers, agents: agent("triage") }));
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  let npm: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'the npm registry lists the versions "2.3.1" and "3.0.0" of "@opensoftware/harness-claude-code"',
    async () => {
      const name = "@opensoftware/harness-claude-code";
      npm = await fakes.http([{ path: packumentPath(name), body: packument(name, ["2.3.1", "3.0.0"]) }]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan --adapters"', async () => {
    run = await sut.cli(["plan", "--adapters"], { env: { FACTORY_NPM_REGISTRY: npm.url } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "the npm registry has no version of \\"@opensoftware/harness-claude-code\\" that matches \\"^4\\""',
    async () => {
      expect(run.stderr).toContain(
        'the npm registry has no version of "@opensoftware/harness-claude-code" that matches "^4"',
      );
    },
  );
});
