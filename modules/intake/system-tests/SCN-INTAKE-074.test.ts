import { scenario } from "@opensoftware/testkit";
import { API_TOKEN } from "./server.ts";

scenario("SCN-INTAKE-074", async ({ sut, given, when, then }) => {
  await given("an empty working folder", async () => {
    await sut.files.clear("$INPUT");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "intake serve" with "INTAKE_PERSON_KEYS" set to "console"', async () => {
    run = await sut.cli(["serve"], { env: { INTAKE_API_TOKEN: API_TOKEN, INTAKE_PERSON_KEYS: "console" } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the error output says "INTAKE_PERSON_KEYS: a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "console" is not"',
    async () => {
      expect(run.stderr).toContain(
        'intake: INTAKE_PERSON_KEYS: a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "console" is not\n',
      );
    },
  );
});
