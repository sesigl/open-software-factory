import { scenario } from "@opensoftware/testkit";
import { putEnvSecret } from "./edit.ts";

const PROBLEM =
  'the edit would make factory.yaml fail "factory lint": factory.yaml:15:5 /agents/triage/sandbox/template: missing required field';

scenario("SCN-FSPEC-085", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"',
    async () => {
      await putEnvSecret(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-egress triage github.com"', async () => {
    run = await sut.cli(["edit", "add-egress", "triage", "github.com"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the error is the one line "the edit would make factory.yaml fail \\"factory lint\\": factory.yaml:15:5 /agents/triage/sandbox/template: missing required field"',
    async () => {
      expect(run.stderr).toBe(`${PROBLEM}\n`);
    },
  );
});
