import { scenario } from "@opensoftware/testkit";
import { putTriage } from "./edit.ts";

scenario("SCN-FSPEC-086", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has no skills', async () => {
    await putTriage(sut, []);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-skill deploy ./skills/review"', async () => {
    run = await sut.cli(["edit", "add-skill", "deploy", "./skills/review"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error is the one line "factory.yaml declares no agent \\"deploy\\""', async () => {
    expect(run.stderr).toBe('factory.yaml declares no agent "deploy"\n');
  });
});
