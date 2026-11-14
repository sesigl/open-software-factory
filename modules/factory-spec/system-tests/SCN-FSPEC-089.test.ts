import { scenario } from "@opensoftware/testkit";
import { putTriage, USAGE } from "./edit.ts";

scenario("SCN-FSPEC-089", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has no skills', async () => {
    await putTriage(sut, []);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit rename-agent triage deploy"', async () => {
    run = await sut.cli(["edit", "rename-agent", "triage", "deploy"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the error is the one line "usage: factory edit add-skill|remove-skill|add-secret|remove-secret|add-egress|remove-egress <agent> <value>, or factory edit add-secrets-provider <name> <range>"',
    async () => {
      expect(run.stderr).toBe(USAGE);
    },
  );
});
