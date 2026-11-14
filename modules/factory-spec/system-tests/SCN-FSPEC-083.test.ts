import { scenario } from "@opensoftware/testkit";
import { putEnvSecret } from "./edit.ts";

scenario("SCN-FSPEC-083", async ({ sut, given, when, then }) => {
  let yaml = "";
  await given(
    'a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"',
    async () => {
      yaml = await putEnvSecret(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit remove-egress triage github.com"', async () => {
    run = await sut.cli(["edit", "remove-egress", "triage", "github.com"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the output is factory.yaml, byte for byte", async () => {
    expect(run.stdout).toBe(yaml);
  });
});
