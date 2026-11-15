import { scenario } from "@opensoftware/testkit";

// Claims only: the digest is made up, since a proof's claims are checked without its signature.
const PROOF = {
  iss: "console",
  sub: "ada@acme.dev",
  name: "Ada",
  role: "member",
  aud: "foreman",
  iat: 1794736800,
  exp: 1794736830,
  method: "POST",
  path: "/v1/runs/run_0123456789abcdef0123/signals",
  bodyDigest: "fixture-body-digest-made-up-000000000000000",
};

scenario("SCN-CTR-025", async ({ sut, given, when, then }) => {
  await given(
    'a person proof "proof.json" of "ada@acme.dev" with the role "member" for "POST /v1/runs/run_0123456789abcdef0123/signals" of the audience "foreman"',
    async () => {
      await sut.files.put("$INPUT/proof.json", JSON.stringify(PROOF));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate person-proof proof.json"', async () => {
    run = await sut.cli(["validate", "person-proof", "proof.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "proof.json: valid person-proof"', async () => {
    expect(run.stdout).toContain("proof.json: valid person-proof");
  });
});
