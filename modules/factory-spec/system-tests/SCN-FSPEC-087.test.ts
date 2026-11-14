import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

const PROBLEM =
  'factory.yaml does not pass "factory lint": factory.yaml:8:5 harness "codex" is not declared under providers.harness; factory.yaml:11:15 secret "ref:vault/linear-token" uses the provider "vault", which providers.secrets does not declare';

scenario("SCN-FSPEC-087", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" names the harness "codex" and the secret "ref:vault/linear-token", neither of them declared',
    async () => {
      await sut.files.put(
        "$INPUT/factory.yaml",
        factoryYaml({ agents: agent("triage", ["secrets: [ref:vault/linear-token]"], "codex") }),
      );
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-skill triage ./skills/review"', async () => {
    run = await sut.cli(["edit", "add-skill", "triage", "./skills/review"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the error is the one line "factory.yaml does not pass \\"factory lint\\": factory.yaml:8:5 harness \\"codex\\" is not declared under providers.harness; factory.yaml:11:15 secret \\"ref:vault/linear-token\\" uses the provider \\"vault\\", which providers.secrets does not declare"',
    async () => {
      expect(run.stderr).toBe(`${PROBLEM}\n`);
    },
  );
});
