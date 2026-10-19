import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-003", async ({ sut, given, when, then }) => {
  let providers: string[] = [];
  await given('a factory.yaml whose agent "triage" has the secret "ref:vault/linear-token" on line 14', async () => {
    providers = ["harness:", '  claude-code: "^2"'];
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  await given('providers.secrets declares only "openbao"', async () => {
    const yaml = factoryYaml({
      providers: [...providers, "secrets:", '  openbao: "^1"'],
      agents: agent("triage", ["secrets:", "  - ref:vault/linear-token"]),
    });
    await sut.files.put("$INPUT/factory.yaml", yaml);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "factory.yaml:14:9 secret \\"ref:vault/linear-token\\" uses the provider \\"vault\\", which providers.secrets does not declare"',
    async () => {
      expect(run.stdout).toContain(
        'factory.yaml:14:9 secret "ref:vault/linear-token" uses the provider "vault", which providers.secrets does not declare',
      );
    },
  );
});
