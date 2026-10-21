import { scenario } from "@opensoftware/testkit";

scenario("SCN-LEDGER-002", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger --help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output lists the commands "ingest" and "report"', async () => {
    expect(run.stdout).toMatch(/^ {2}ingest /m);
    expect(run.stdout).toMatch(/^ {2}report /m);
  });
});
