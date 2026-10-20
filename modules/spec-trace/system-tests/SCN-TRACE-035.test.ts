import { scenario } from "@opensoftware/testkit";

scenario("SCN-TRACE-035", async ({ sut, given, when, then }) => {
  await given('a repository with a spec-trace.json whose "tests" is the text "*.test.ts"', async () => {
    await sut.files.put("$INPUT/spec-trace.json", JSON.stringify({ tests: "*.test.ts" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check"', async () => {
    run = await sut.cli(["check"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then("the error output contains 'spec-trace: spec-trace.json: \"tests\" must be a list of globs'", async () => {
    expect(run.stderr).toContain('spec-trace: spec-trace.json: "tests" must be a list of globs');
  });
});
