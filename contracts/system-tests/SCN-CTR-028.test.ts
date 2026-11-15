import { scenario } from "@opensoftware/testkit";

// A made-up key, worthless: the format checks the members and their form, not the curve point.
const KEY = {
  kty: "OKP",
  crv: "Ed25519",
  alg: "Ed25519",
  use: "sig",
  kid: "fixture-kid-worthless-made-up-0000000000000",
  x: "fixture-public-key-worthless-made-up-000000",
};

scenario("SCN-CTR-028", async ({ sut, given, when, then }) => {
  await given('a key set "keys.json" with one Ed25519 public key and its thumbprint as "kid"', async () => {
    await sut.files.put("$INPUT/keys.json", JSON.stringify({ keys: [KEY] }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate person-keys keys.json"', async () => {
    run = await sut.cli(["validate", "person-keys", "keys.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "keys.json: valid person-keys"', async () => {
    expect(run.stdout).toContain("keys.json: valid person-keys");
  });
});
