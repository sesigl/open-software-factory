import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import type { Run } from "./input.ts";
import { API_TOKEN, SERVE } from "./server.ts";

// No server starts: the setting stops it before it opens the database.
const ENV: Record<string, string> = {
  GATEKEEPER_DATABASE_URL: "postgres://gatekeeper@127.0.0.1:1/gatekeeper",
  GATEKEEPER_API_TOKEN: API_TOKEN,
  GATEKEEPER_SLACK_TOKEN: "testkit-slack-token",
  GATEKEEPER_SLACK_SIGNING_SECRET: "testkit-signing-secret",
  GATEKEEPER_PERSON_KEYS: "console",
};

scenario("SCN-GATE-103", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  let run: Run;
  await when('the user runs "gatekeeper serve" with "GATEKEEPER_PERSON_KEYS" set to "console"', async () => {
    run = await sut.cli(SERVE, { env: ENV });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    `its error output says 'gatekeeper: GATEKEEPER_PERSON_KEYS: a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "console" is not'`,
    async () => {
      expect(run.stderr).toBe(
        'gatekeeper: GATEKEEPER_PERSON_KEYS: a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "console" is not\n',
      );
    },
  );
});
