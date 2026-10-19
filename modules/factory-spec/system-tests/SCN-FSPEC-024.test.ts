import { scenario } from "@opensoftware/testkit";
import { applied } from "./applied.ts";

scenario("SCN-FSPEC-024", async ({ sut, given, when, then }) => {
  await given('the factory "web-app" was applied with the agent "triage"', async () => {
    await applied(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "No changes."', async () => {
    expect(run.stdout).toBe("No changes.\n");
  });
});
