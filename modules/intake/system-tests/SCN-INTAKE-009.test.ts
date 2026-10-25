import { scenario } from "@opensoftware/testkit";

scenario("SCN-INTAKE-009", async ({ sut, given, when, then }) => {
  await given("an empty working folder", async () => {
    await sut.files.clear("$INPUT");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "intake serve" without "INTAKE_API_TOKEN"', async () => {
    run = await sut.cli(["serve"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the error output says "set INTAKE_API_TOKEN"', async () => {
    expect(run.stderr).toContain("intake: set INTAKE_API_TOKEN: the token that callers of the API send");
  });
});
