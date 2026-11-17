import { type FakePersonIssuer, type ReadProof, scenario } from "@opensoftware/testkit";

scenario("SCN-TK-184", async ({ fakes, given, when, then }) => {
  const body = '{"signal":"cancel"}';
  let issuer: FakePersonIssuer;
  let other: FakePersonIssuer;
  let proof = "";
  await given('a proof of "ada@acme.dev" for a body, signed by fakes.personIssuer, and another issuer', async () => {
    issuer = await fakes.personIssuer();
    other = await fakes.personIssuer();
    proof = await issuer.prove({ sub: "ada@acme.dev", aud: "foreman", path: "/v1/runs/run_1/signals", body });
  });

  let reads: ReadProof[] = [];
  await when(
    "the test reads it with fakes.personProof at the issuer's key set with that body, at the other issuer's key set, and with another body",
    async () => {
      reads = await Promise.all([
        fakes.personProof(proof, issuer.url, body),
        fakes.personProof(proof, other.url, body),
        fakes.personProof(proof, issuer.url, '{"signal":"approve"}'),
      ]);
    },
  );

  await then(
    "it has the claims and the header, and a verified proof with a matching body only for the first",
    async () => {
      expect(reads.map(({ verified, bodyMatches }) => [verified, bodyMatches])).toEqual([
        [true, true],
        [false, true],
        [true, false],
      ]);
      expect(reads[0]?.claims).toMatchObject({ iss: "console", sub: "ada@acme.dev", aud: "foreman", role: "member" });
      expect(reads[0]?.header).toEqual({ alg: "Ed25519", typ: "osf-person+jwt", kid: issuer.keys.keys[0]?.kid });
    },
  );
});
