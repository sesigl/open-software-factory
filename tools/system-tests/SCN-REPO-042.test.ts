import { scenario } from "@opensoftware/testkit";

scenario("SCN-REPO-042", async ({ sut, given, when, then }) => {
  let base = "";
  await given("a base commit", async () => {
    await sut.files.put("$INPUT/README.md", "# Demo\n");
    base = await sut.git.commit("base");
  });

  await given('a later commit without a "Co-Authored-By:" trailer that changes no file in "runs/"', async () => {
    await sut.files.put("$INPUT/README.md", "# Demo\n\nA demo.\n");
    await sut.git.commit("docs: describe the demo");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check RUNS" against the base commit', async () => {
    run = await sut.cli(["check", "RUNS"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });
});
