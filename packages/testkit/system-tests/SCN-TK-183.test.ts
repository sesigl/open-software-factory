import { type FakePersonIssuer, scenario } from "@opensoftware/testkit";
import { verifyProof } from "./person-issuer.ts";

scenario("SCN-TK-183", async ({ fakes, given, when, then }) => {
  let issuer: FakePersonIssuer;
  let proof = "";
  await given(
    'fakes.personIssuer named "acme-portal" with the setting "acme-portal=<url>", and a proof it signed without "exp", with the role "admin", the type "JWT" and the algorithm "EdDSA"',
    async () => {
      issuer = await fakes.personIssuer({ name: "acme-portal" });
      expect(issuer.setting).toBe(`acme-portal=${issuer.url}`);
      expect(issuer.name).toBe("acme-portal");
      proof = await issuer.prove(
        { sub: "grace@acme.dev", aud: "gatekeeper", path: "/v1/gates/g1/decisions", role: "admin", exp: undefined },
        { typ: "JWT", alg: "EdDSA" },
      );
    },
  );

  let read: Record<string, unknown> = {};
  await when("a module fetches the key set of the issuer and verifies the proof with its key", async () => {
    read = await verifyProof(issuer.url, proof, "");
  });

  await then('the proof verifies with the issuer "acme-portal" and the changed claims and header', async () => {
    expect(read).toEqual({
      valid: true,
      keys: 1,
      kid: true,
      header: { alg: "EdDSA", typ: "JWT" },
      claims: {
        iss: "acme-portal",
        sub: "grace@acme.dev",
        role: "admin",
        aud: "gatekeeper",
        iat: 1767225600,
        method: "POST",
        path: "/v1/gates/g1/decisions",
        // The SHA-256 of an empty body, in base64url.
        bodyDigest: "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU",
      },
      digest: true,
    });
  });
});
