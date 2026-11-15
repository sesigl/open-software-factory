import type { PersonCheck, PersonChecker } from "@opensoftware/person-proof";
import type { FakePersonIssuer } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { CLAIMS, foremanOf, refused, request } from "./proof.ts";

/** The proof with the header {"alg":"none","typ":"osf-person+jwt"} and no signature. */
const unsigned = (proof: string): string => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "osf-person+jwt" })).toString("base64url");
  return `${header}.${proof.split(".")[1]}.`;
};

scenario("SCN-PPROOF-012", async ({ fakes, given, when, then }) => {
  let issuer: FakePersonIssuer;
  let checker: PersonChecker;
  await given('a checker of "foreman" with the setting of an issuer', async () => {
    ({ issuer, checker } = await foremanOf(fakes));
  });

  let checks: PersonCheck[] = [];
  await when(
    'it checks a proof of the type "JWT", a proof of the algorithm "EdDSA" and a proof of the algorithm "none" without a signature',
    async () => {
      const proofs = await Promise.all([
        issuer.prove(CLAIMS, { typ: "JWT" }),
        issuer.prove(CLAIMS, { alg: "EdDSA" }),
        issuer.prove(CLAIMS).then(unsigned),
      ]);
      checks = await Promise.all(proofs.map((proof) => checker.check(request(proof))));
    },
  );

  await then('the first is refused with 401 "the person proof\'s typ is "JWT", not "osf-person+jwt""', async () => {
    expect(checks[0]).toEqual(refused(401, 'the person proof\'s typ is "JWT", not "osf-person+jwt"'));
  });

  await then('the second is refused with 401 "the person proof\'s alg is "EdDSA", not "Ed25519""', async () => {
    expect(checks[1]).toEqual(refused(401, 'the person proof\'s alg is "EdDSA", not "Ed25519"'));
  });

  await then('the third is refused with 401 "the person proof\'s alg is "none", not "Ed25519""', async () => {
    expect(checks[2]).toEqual(refused(401, 'the person proof\'s alg is "none", not "Ed25519"'));
    expect(issuer.fetched()).toBe(0);
  });
});
