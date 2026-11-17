import { type FakePersonIssuer, scenario } from "@opensoftware/testkit";
import { verifyProof } from "./person-issuer.ts";

scenario("SCN-TK-182", async ({ fakes, given, when, then }) => {
  const body = '{"signal":"approve"}';
  let issuer: FakePersonIssuer;
  let proof = "";
  await given(
    'a proof of "ada@acme.dev" named "Ada" for "POST /v1/runs/run_1/signals" of "foreman" with a body, signed by fakes.personIssuer',
    async () => {
      issuer = await fakes.personIssuer();
      proof = await issuer.prove({
        sub: "ada@acme.dev",
        name: "Ada",
        aud: "foreman",
        path: "/v1/runs/run_1/signals",
        body,
      });
    },
  );

  let read: Record<string, unknown> = {};
  await when("a module fetches the key set of the issuer and verifies the proof with its key", async () => {
    read = await verifyProof(issuer.url, proof, body);
  });

  await then(
    'the proof has a valid signature of the key\'s "kid", the type "osf-person+jwt", the issuer "console", the role "member", 2026-01-01T00:00:00Z and 30 seconds, and the body\'s SHA-256',
    async () => {
      expect(read).toEqual({
        valid: true,
        keys: 1,
        kid: true,
        header: { alg: "Ed25519", typ: "osf-person+jwt" },
        claims: {
          iss: "console",
          sub: "ada@acme.dev",
          name: "Ada",
          role: "member",
          aud: "foreman",
          iat: 1767225600,
          exp: 1767225630,
          method: "POST",
          path: "/v1/runs/run_1/signals",
          // The SHA-256 of the body, in base64url.
          bodyDigest: "oqjDoqd94sL9NLousgFwDB9z4xrxT4qI_TDz52GcMEQ",
        },
        digest: true,
      });
    },
  );
});
