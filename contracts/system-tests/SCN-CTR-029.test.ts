import { scenario } from "@opensoftware/testkit";

// Made-up values, worthless: a key set must never hold a private part, whatever its value.
const KEY = {
  kty: "OKP",
  crv: "Ed25519",
  alg: "Ed25519",
  use: "sig",
  kid: "fixture-kid-worthless-made-up-0000000000000",
  x: "fixture-public-key-worthless-made-up-000000",
  d: "fixture-private-part-worthless-made-up-0000",
};

scenario("SCN-CTR-029", async ({ sut, given, when, then }) => {
  await given('a key set "keys.json" whose Ed25519 key also has the private part "d"', async () => {
    await sut.files.put("$INPUT/keys.json", JSON.stringify({ keys: [KEY] }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate person-keys keys.json"', async () => {
    run = await sut.cli(["validate", "person-keys", "keys.json"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "keys.json /keys/0/d: unknown field"', async () => {
    expect(run.stdout).toContain("keys.json /keys/0/d: unknown field");
  });
});
