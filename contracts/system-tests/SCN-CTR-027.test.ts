import { scenario } from "@opensoftware/testkit";

const ALLOWED = 'proof.json /role: must be one of "member", "factory-engineer", "admin"';

scenario("SCN-CTR-027", async ({ sut, given, when, then }) => {
  await given(
    'a person proof "proof.json" of "ada@acme.dev" with the role "owner", the method "post" and the body digest "abc"',
    async () => {
      const proof = {
        iss: "console",
        sub: "ada@acme.dev",
        role: "owner",
        aud: "gatekeeper",
        iat: 1794736800,
        exp: 1794736830,
        method: "post",
        path: "/v1/gates/gate_0123/decisions",
        bodyDigest: "abc",
      };
      await sut.files.put("$INPUT/proof.json", JSON.stringify(proof));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate person-proof proof.json"', async () => {
    run = await sut.cli(["validate", "person-proof", "proof.json"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "proof.json /role: must be one of \\"member\\", \\"factory-engineer\\", \\"admin\\""',
    async () => {
      expect(run.stdout).toContain(ALLOWED);
    },
  );

  await then('the output contains "proof.json /method: must match pattern"', async () => {
    expect(run.stdout).toContain("proof.json /method: must match pattern");
  });

  await then('the output contains "proof.json /bodyDigest: must match pattern"', async () => {
    expect(run.stdout).toContain("proof.json /bodyDigest: must match pattern");
  });
});
