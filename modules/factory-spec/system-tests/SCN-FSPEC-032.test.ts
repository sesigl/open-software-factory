import { scenario } from "@opensoftware/testkit";

scenario("SCN-FSPEC-032", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "factory --help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode).toBe(0);
  });

  await then('the output lists the commands "lint", "render", "plan", "apply", "diff" and "resolve"', async () => {
    for (const command of ["lint", "render", "plan", "apply", "diff", "resolve"]) {
      expect(run.stdout).toMatch(new RegExp(`^  factory ${command}\\b`, "m"));
    }
  });
});
