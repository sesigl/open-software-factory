import { scenario } from "@opensoftware/testkit";
import { adapterLock, agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-093", async ({ sut, given, when, then }) => {
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

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan --check"', async () => {
    run = await sut.cli(["plan", "--check"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "factory.lock has no pin of the forge \\"github\\" for \\"^1\\": run \\"factory plan --adapters\\""',
    async () => {
      expect(run.stdout).toBe(
        'factory.lock has no pin of the forge "github" for "^1": run "factory plan --adapters"\n',
      );
    },
  );

  await then('"factory.lock" still pins the forge "github" at "^0" to "0.3.1"', async () => {
    const lock = JSON.parse(await sut.files.read("$INPUT/factory.lock"));
    expect(lock.adapters.forge.github).toEqual({ range: "^0", version: "0.3.1" });
  });
});
