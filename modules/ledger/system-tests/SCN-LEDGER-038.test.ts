import { scenario } from "@opensoftware/testkit";

scenario("SCN-LEDGER-038", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given('a PostgreSQL database with the user "test" and the password "test"', async () => {
    url = (await fakes.postgres()).url;
    expect(url).toMatch(/^postgres:\/\/test:test@/);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "ledger report" with "LEDGER_DB" set to the database\'s URL with the password "wrong-password"',
    async () => {
      run = await sut.cli(["report"], { env: { LEDGER_DB: url.replace("test:test@", "test:wrong-password@") } });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output says "ledger: cannot open postgres://test:***@"', async () => {
    expect(run.stderr).toContain("ledger: cannot open postgres://test:***@");
  });

  await then('the output and the error output do not contain "wrong-password"', async () => {
    expect(run.stdout + run.stderr).not.toContain("wrong-password");
  });
});
