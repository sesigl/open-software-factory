import { type PersonCheck, type PersonSigner, personChecker, personSigner } from "@opensoftware/person-proof";
import type { FakeHttp } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { ADA, at, BODY, IAT, PATH, request, SEED, served } from "./proof.ts";

scenario("SCN-PPROOF-001", async ({ fakes, given, when, then }) => {
  let signer: PersonSigner;
  let keys: FakeHttp;
  await given(
    "a signer of one signing key on the clock 2026-01-01T00:00:00Z, its key set served at a URL",
    async () => {
      signer = await personSigner(SEED, { now: at(0) });
      keys = await served(fakes, signer);
    },
  );

  let proof = "";
  await when(
    'it signs a proof of "ada@acme.dev" named "Ada" with the role "member" for "POST /v1/runs/run_1/signals" of "foreman" with a body',
    async () => {
      proof = await signer.prove({
        person: "ada@acme.dev",
        name: "Ada",
        role: "member",
        audience: "foreman",
        method: "POST",
        path: PATH,
        body: BODY,
      });
    },
  );

  let check: PersonCheck;
  await when(
    'a checker of "foreman" with the setting "console=<url>" checks it 5 seconds later in the header "OSF-Person" of that request, with the query "?view=1", for the person "ada@acme.dev"',
    async () => {
      const checker = personChecker(`console=${keys.url}/.well-known/jwks.json`, { audience: "foreman", now: at(5) });
      check = await checker.check(request(proof, { path: `${PATH}?view=1`, body: new TextEncoder().encode(BODY) }));
    },
  );

  await then('the check gives the actor of kind "person" "ada@acme.dev" named "Ada"', async () => {
    expect(check).toMatchObject({ ok: true, actor: { ...ADA, displayName: "Ada" } });
  });

  await then(
    'the proof\'s claims: the issuer "console", the person, the role, the audience, 2026-01-01T00:00:00Z, its end 30 seconds later, the method, the path and the SHA-256 of the body',
    async () => {
      expect(check.ok && check.proof).toEqual({
        iss: "console",
        sub: "ada@acme.dev",
        name: "Ada",
        role: "member",
        aud: "foreman",
        iat: IAT,
        exp: IAT + 30,
        method: "POST",
        path: PATH,
        // The SHA-256 of BODY, in base64url.
        bodyDigest: "oqjDoqd94sL9NLousgFwDB9z4xrxT4qI_TDz52GcMEQ",
      });
    },
  );

  await then(
    'the proof\'s header names the algorithm "Ed25519", the type "osf-person+jwt" and the "kid" of the key set\'s key',
    async () => {
      const header = JSON.parse(Buffer.from(proof.split(".")[0] ?? "", "base64url").toString());
      expect(header).toEqual({ alg: "Ed25519", typ: "osf-person+jwt", kid: signer.keys.keys[0]?.kid });
      expect(keys.requests()).toEqual(["GET /.well-known/jwks.json"]);
    },
  );
});
