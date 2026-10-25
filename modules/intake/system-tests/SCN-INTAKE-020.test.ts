import { scenario } from "@opensoftware/testkit";

scenario("SCN-INTAKE-020", async ({ sut, given, when, then }) => {
  await given("an empty working folder", async () => {
    await sut.files.clear("$INPUT");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "intake mcp" without "INTAKE_URL"', async () => {
    run = await sut.cli(["mcp"], { env: { INTAKE_API_TOKEN: "token", INTAKE_REQUESTER: "github:varun" } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the error output says "set INTAKE_URL"', async () => {
    expect(run.stderr).toContain("intake: set INTAKE_URL: the base URL of intake serve");
  });
});
