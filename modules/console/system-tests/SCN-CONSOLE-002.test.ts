import { scenario } from "@opensoftware/testkit";

scenario("SCN-CONSOLE-002", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console --help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output names the command "serve"', async () => {
    expect(run.stdout).toMatch(/^ {2}serve {2}Serve the read-only web view/m);
  });
});
