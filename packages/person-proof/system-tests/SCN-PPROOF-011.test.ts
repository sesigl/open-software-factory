import type { PersonCheck, PersonChecker } from "@opensoftware/person-proof";
import type { FakePersonIssuer } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { CLAIMS, foremanOf, refused, request } from "./proof.ts";

scenario("SCN-PPROOF-011", async ({ fakes, given, when, then }) => {
  let known: FakePersonIssuer;
  let checker: PersonChecker;
  await given('a checker of "foreman" with the setting "console=<url>" of one issuer', async () => {
    ({ issuer: known, checker } = await foremanOf(fakes));
  });

  let other: FakePersonIssuer;
  let checks: PersonCheck[] = [];
  await when(
    'it checks a proof that another issuer named "console" signed, once with its own "kid" and once with the "kid" of the first issuer\'s key',
    async () => {
      other = await fakes.personIssuer();
      const proofs = await Promise.all([other.prove(CLAIMS), other.prove(CLAIMS, { kid: known.keys.keys[0]?.kid })]);
      checks = await Promise.all(proofs.map((proof) => checker.check(request(proof))));
    },
  );

  await then(
    'the first is refused with 401 "the person proof\'s key "<kid>" is not in the key set of the issuer "console""',
    async () => {
      const kid = other.keys.keys[0]?.kid;
      expect(checks[0]).toEqual(
        refused(401, `the person proof's key "${kid}" is not in the key set of the issuer "console"`),
      );
    },
  );

  await then(
    'the second is refused with 401 "the person proof\'s signature does not verify with the key set of the issuer "console""',
    async () => {
      expect(checks[1]).toEqual(
        refused(401, 'the person proof\'s signature does not verify with the key set of the issuer "console"'),
      );
    },
  );
});
