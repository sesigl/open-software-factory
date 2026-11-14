import { scenario } from "@opensoftware/testkit";
import { putEnvSecret } from "./edit.ts";

scenario("SCN-FSPEC-081", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"',
    async () => {
      await putEnvSecret(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-secrets-provider env ^1"', async () => {
    run = await sut.cli(["edit", "add-secrets-provider", "env", "^1"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error is the one line "providers.secrets declares \\"env\\" at \\"^0\\", not \\"^1\\""', async () => {
    expect(run.stderr).toBe('providers.secrets declares "env" at "^0", not "^1"\n');
  });

  await then("the output is empty", async () => {
    expect(run.stdout).toBe("");
  });
});
