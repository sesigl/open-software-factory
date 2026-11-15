import { type PersonCheck, type PersonSigner, personChecker, personSigner } from "@opensoftware/person-proof";
import { scenario } from "@opensoftware/testkit";
import { at, BODY, OTHER_SEED, PATH, request, served } from "./proof.ts";

// The seed of the first test of RFC 8032 (section 7.1), a published test vector, and its public key in base64url.
const RFC_SEED = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const RFC_X = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";
// Its JWK thumbprint (RFC 7638): the SHA-256 of {"crv":"Ed25519","kty":"OKP","x":"<RFC_X>"}, in base64url.
const RFC_KID = "kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k";

scenario("SCN-PPROOF-002", async ({ fakes, given, when, then }) => {
  let setting = "";
  await given('the signing setting "<the seed of RFC 8032\'s first test>,<a second seed>"', async () => {
    setting = `${RFC_SEED},${OTHER_SEED}`;
  });

  let first: PersonSigner;
  let second: PersonSigner;
  await when(
    'a program makes a signer of it and one of the two seeds the other way round, named "acme-portal"',
    async () => {
      first = await personSigner(setting, { now: at(0) });
      second = await personSigner(`${OTHER_SEED}, ${RFC_SEED}`, { issuer: "acme-portal", now: at(0) });
    },
  );

  await then(
    'the key set of the first holds the public key of RFC 8032\'s first test with its thumbprint as "kid", then the second key, each with "kty" "OKP", "crv" "Ed25519", "alg" "Ed25519" and "use" "sig" and nothing else',
    async () => {
      const fixed = { kty: "OKP", crv: "Ed25519", alg: "Ed25519", use: "sig" };
      const [rfc, other] = first.keys.keys;
      expect(rfc).toEqual({ ...fixed, kid: RFC_KID, x: RFC_X });
      expect(other).toEqual({ ...fixed, kid: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), x: expect.any(String) });
      expect(second.keys.keys).toEqual([other, rfc]);
    },
  );

  await then(
    'a proof of the second signer for "grace@acme.dev" without a name is accepted by a checker of the key set of the first, and gives the actor without a name',
    async () => {
      const keys = await served(fakes, first);
      const proof = await second.prove({
        person: "grace@acme.dev",
        role: "factory-engineer",
        audience: "foreman",
        method: "POST",
        path: PATH,
        body: BODY,
      });
      const checker = personChecker(`acme-portal=${keys.url}/.well-known/jwks.json`, {
        audience: "foreman",
        now: at(0),
      });
      const check: PersonCheck = await checker.check(
        request(proof, { actor: { kind: "person", id: "grace@acme.dev" } }),
      );
      expect(check).toMatchObject({ ok: true, actor: { kind: "person", id: "grace@acme.dev" } });
      expect(check.ok && check.actor).not.toHaveProperty("displayName");
      expect(check.ok && check.proof).not.toHaveProperty("name");
      const header = JSON.parse(Buffer.from(proof.split(".")[0] ?? "", "base64url").toString());
      // The second signer signs with its first key, the second key of the first signer.
      expect(header.kid).toBe(first.keys.keys[1]?.kid);
    },
  );
});
