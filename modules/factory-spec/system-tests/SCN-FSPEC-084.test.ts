import { scenario } from "@opensoftware/testkit";
import { putEnvSecret } from "./edit.ts";

const PROBLEM =
  'the edit would make factory.yaml fail "factory lint": factory.yaml:13:33 secret "ref:vault/linear-token" uses the provider "vault", which providers.secrets does not declare';

scenario("SCN-FSPEC-084", async ({ sut, given, when, then }) => {
  let yaml = "";
  await given(
    'a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"',
    async () => {
      yaml = await putEnvSecret(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-secret triage ref:vault/linear-token"', async () => {
    run = await sut.cli(["edit", "add-secret", "triage", "ref:vault/linear-token"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the error is the one line "the edit would make factory.yaml fail \\"factory lint\\": factory.yaml:13:33 secret \\"ref:vault/linear-token\\" uses the provider \\"vault\\", which providers.secrets does not declare"',
    async () => {
      expect(run.stderr).toBe(`${PROBLEM}\n`);
    },
  );

  await then("the output is empty", async () => {
    expect(run.stdout).toBe("");
  });

  await then("factory.yaml in the factory folder is unchanged", async () => {
    expect(await sut.files.read("$INPUT/factory.yaml")).toBe(yaml);
  });
});
