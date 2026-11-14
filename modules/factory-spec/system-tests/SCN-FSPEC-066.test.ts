import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, packument, packumentPath, prompt } from "./factory.ts";

scenario("SCN-FSPEC-066", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a factory.yaml with "claude-code" at "^2" under "providers.harness" and "github" at "^0" under "providers.forge"',
    async () => {
      const providers = ["harness:", '  claude-code: "^2"', "forge:", '  github: "^0"'];
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ providers, agents: agent("triage") }));
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  const routes: { path: string; body: unknown }[] = [];
  await given(
    'the npm registry lists the versions "1.9.0", "2.0.0", "2.3.1" and "3.0.0" of "@opensoftware/harness-claude-code"',
    async () => {
      const name = "@opensoftware/harness-claude-code";
      routes.push({ path: packumentPath(name), body: packument(name, ["1.9.0", "2.0.0", "2.3.1", "3.0.0"]) });
    },
  );

  let npm: Awaited<ReturnType<typeof fakes.http>>;
  await given('it lists the versions "0.2.0" and "0.3.1" of "@opensoftware/forge-github"', async () => {
    const name = "@opensoftware/forge-github";
    routes.push({ path: packumentPath(name), body: packument(name, ["0.2.0", "0.3.1"]) });
    npm = await fakes.http(routes);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan --adapters"', async () => {
    run = await sut.cli(["plan", "--adapters"], { env: { FACTORY_NPM_REGISTRY: `${npm.url}/` } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"factory.lock" pins the harness "claude-code" at "^2" to "2.3.1" and the forge "github" at "^0" to "0.3.1"',
    async () => {
      const lock = JSON.parse(await sut.files.read("$INPUT/factory.lock"));
      expect(lock).toEqual({
        version: 1,
        mcp: {},
        adapters: {
          harness: { "claude-code": { range: "^2", version: "2.3.1" } },
          forge: { github: { range: "^0", version: "0.3.1" } },
        },
      });
    },
  );
});
