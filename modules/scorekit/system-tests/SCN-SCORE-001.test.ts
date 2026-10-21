import { scenario } from "@opensoftware/testkit";

// One file per scenario, named after its ID.
scenario("SCN-SCORE-001", async ({ sut, given, when, then }) => {
  await given("an empty working folder", async () => {
    await sut.files.clear("$INPUT");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when("the user runs the quick start command from the README", async () => {
    run = await sut.cli(sut.readme.quickStartArgs());
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the output folder contains the file the README promises", async () => {
    expect(await sut.files.list("$OUTPUT")).toContain(sut.readme.quickStartOutput());
  });
});
