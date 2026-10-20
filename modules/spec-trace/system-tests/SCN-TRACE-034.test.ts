import { scenario } from "@opensoftware/testkit";

scenario("SCN-TRACE-034", async ({ sut, given, when, then }) => {
  await given('a repository with a spec-trace.json with the key "feature"', async () => {
    await sut.files.put("$INPUT/spec-trace.json", JSON.stringify({ feature: ["**/*.feature"] }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check"', async () => {
    run = await sut.cli(["check"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then("the error output contains 'spec-trace: spec-trace.json: unknown key \"feature\"'", async () => {
    expect(run.stderr).toContain('spec-trace: spec-trace.json: unknown key "feature"');
  });
});
