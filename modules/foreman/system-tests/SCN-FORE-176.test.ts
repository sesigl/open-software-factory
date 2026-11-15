import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, committed, servingCommit } from "./foreman.ts";

const UNSET = "FOREMAN_PERSON_KEYS is not set: a caller with FOREMAN_API_TOKEN acts as any person it names (ADR 0151)";

scenario("SCN-FORE-176", async ({ sut, fakes, given, when, then }) => {
  let commit = "";
  await given("the README's factory, committed", async () => {
    commit = await committed(sut, fakes);
  });

  let malformed: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "foreman serve" with "FOREMAN_PERSON_KEYS" set to "console", and then without it',
    async () => {
      malformed = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN, FOREMAN_PERSON_KEYS: "console" } });
      await servingCommit(sut, fakes, commit);
    },
  );

  await then('the first command exits with code 2 and names the setting and the pair "console"', async () => {
    expect(malformed.exitCode, malformed.stderr).toBe(2);
    expect(malformed.stderr).toContain(
      'FOREMAN_PERSON_KEYS: a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "console" is not',
    );
  });

  await then(
    'the server without it warned once "FOREMAN_PERSON_KEYS is not set: a caller with FOREMAN_API_TOKEN acts as any person it names (ADR 0151)"',
    async () => {
      const lines = sut.http.output().stderr.split("\n");
      expect(lines.filter((line) => line.includes("FOREMAN_PERSON_KEYS"))).toEqual([`foreman: ${UNSET}`]);
    },
  );
});
