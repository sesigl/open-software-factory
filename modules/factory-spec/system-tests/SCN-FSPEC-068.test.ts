import { scenario } from "@opensoftware/testkit";
import { adapterLock, agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-068", async ({ sut, fakes, given, when, then }) => {
  await given('a factory.yaml with "claude-code" at "^2" under "providers.harness"', async () => {
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage") }));
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  const lock = adapterLock({ harness: { "claude-code": { range: "^2", version: "2.0.0" } } });
  await given('factory.lock pins the harness "claude-code" at "^2" to "2.0.0"', async () => {
    await sut.files.put("$INPUT/factory.lock", lock);
  });

  let npm: Awaited<ReturnType<typeof fakes.http>>;
  await given("the npm registry answers no request", async () => {
    npm = await fakes.http([]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"], { env: { FACTORY_NPM_REGISTRY: npm.url } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"factory.lock" still pins the harness "claude-code" at "^2" to "2.0.0"', async () => {
    expect(await sut.files.read("$INPUT/factory.lock")).toBe(lock);
    expect(npm.requests()).toEqual([]);
  });
});
