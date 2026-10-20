import { scenario } from "@opensoftware/testkit";

scenario("SCN-PROOF-002", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "proof --help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode).toBe(0);
  });

  await then('the output lists the commands "bundle", "verify" and "attach"', async () => {
    for (const command of ["bundle", "verify", "attach"]) expect(run.stdout).toMatch(new RegExp(`^  ${command} `, "m"));
  });
});
