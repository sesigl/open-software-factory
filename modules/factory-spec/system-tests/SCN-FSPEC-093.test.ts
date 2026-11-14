import { scenario } from "@opensoftware/testkit";
import { adapterLock, agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-093", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml with "claude-code" at "^2" and "codex" at "^1" under "providers.harness", "docker" at "^0" under "providers.sandbox" and "github" at "^1" under "providers.forge"',
    async () => {
      const providers = [
        "harness:",
        '  claude-code: "^2"',
        '  codex: "^1"',
        "sandbox:",
        '  docker: "^0"',
        "forge:",
        '  github: "^1"',
      ];
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ providers, agents: agent("triage") }));
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  await given(
    'factory.lock pins only the harness "claude-code" at "^2" to "2.0.0" and the forge "github" at "^0" to "0.3.1"',
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
    'the output names, one line each, the harness "codex" for "^1", the sandbox "docker" for "^0" and the forge "github" for "^1", with "run \\"factory plan --adapters\\""',
    async () => {
      const missing = ['harness "codex" for "^1"', 'sandbox "docker" for "^0"', 'forge "github" for "^1"'];
      const lines = missing.map((pin) => `factory.lock has no pin of the ${pin}: run "factory plan --adapters"`);
      expect(run.stdout).toBe(`${lines.join("\n")}\n`);
    },
  );

  await then('"factory.lock" still pins the forge "github" at "^0" to "0.3.1"', async () => {
    const lock = JSON.parse(await sut.files.read("$INPUT/factory.lock"));
    expect(lock.adapters.forge.github).toEqual({ range: "^0", version: "0.3.1" });
  });
});
