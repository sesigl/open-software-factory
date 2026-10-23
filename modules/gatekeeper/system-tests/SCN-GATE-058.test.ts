import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { SERVE } from "./server.ts";

scenario("SCN-GATE-058", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "gatekeeper serve" for the channel "slack:C0GATES" without "GATEKEEPER_DATABASE_URL"',
    async () => {
      run = await sut.cli(SERVE, { env: { GATEKEEPER_API_TOKEN: "testkit-api-token" } });
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output says "set GATEKEEPER_DATABASE_URL"', async () => {
    expect(run.stderr).toBe("gatekeeper: set GATEKEEPER_DATABASE_URL: the PostgreSQL database of the gates\n");
  });
});
