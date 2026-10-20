import { scenario } from "@opensoftware/testkit";
import { traced } from "./repo.ts";

scenario("SCN-TRACE-033", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only SPEC,LINT"', async () => {
    run = await sut.cli(["check", "--only", "SPEC,LINT"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('the error output contains "spec-trace: unknown rule LINT; known: SPEC, TRACE, STEPS, PASS"', async () => {
    expect(run.stderr).toContain("spec-trace: unknown rule LINT; known: SPEC, TRACE, STEPS, PASS");
  });
});
