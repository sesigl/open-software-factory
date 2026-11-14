import { scenario } from "@opensoftware/testkit";
import { adapterLock, agent, factoryYaml, packument, packumentPath, prompt } from "./factory.ts";

scenario("SCN-FSPEC-067", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a factory.yaml with "claude-code" at "^2" under "providers.harness" and "github" at "^1" under "providers.forge"',
    async () => {
      const providers = ["harness:", '  claude-code: "^2"', "forge:", '  github: "^1"'];
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ providers, agents: agent("triage") }));
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  await given(
    'factory.lock pins the harness "claude-code" at "^2" to "2.0.0" and the forge "github" at "^0" to "0.3.1"',
    async () => {
      const lock = adapterLock({
        harness: { "claude-code": { range: "^2", version: "2.0.0" } },
        forge: { github: { range: "^0", version: "0.3.1" } },
      });
      await sut.files.put("$INPUT/factory.lock", lock);
    },
  );

  let npm: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'the npm registry lists only the versions "0.3.1" and "1.2.0" of "@opensoftware/forge-github"',
    async () => {
      const name = "@opensoftware/forge-github";
      npm = await fakes.http([{ path: packumentPath(name), body: packument(name, ["0.3.1", "1.2.0"]) }]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan --adapters"', async () => {
    run = await sut.cli(["plan", "--adapters"], { env: { FACTORY_NPM_REGISTRY: npm.url } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"factory.lock" pins the harness "claude-code" at "^2" to "2.0.0" and the forge "github" at "^1" to "1.2.0"',
    async () => {
      const lock = JSON.parse(await sut.files.read("$INPUT/factory.lock"));
      expect(lock.adapters).toEqual({
        harness: { "claude-code": { range: "^2", version: "2.0.0" } },
        forge: { github: { range: "^1", version: "1.2.0" } },
      });
    },
  );
});
