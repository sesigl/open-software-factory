import type { PersonCheck, PersonChecker } from "@opensoftware/person-proof";
import { scenario } from "@opensoftware/testkit";
import { CLAIMS, foremanOf, IAT, refused, request } from "./proof.ts";

scenario("SCN-PPROOF-009", async ({ fakes, given, when, then }) => {
  let checker: PersonChecker;
  let proofs: string[] = [];
  await given(
    'a proof of "ada@acme.dev" for "intake", and one for "foreman" that is not valid before a minute later',
    async () => {
      const foreman = await foremanOf(fakes);
      checker = foreman.checker;
      proofs = await Promise.all([
        foreman.issuer.prove({ ...CLAIMS, aud: "intake" }),
        foreman.issuer.prove({ ...CLAIMS, nbf: IAT + 60 }),
      ]);
    },
  );

  let checks: PersonCheck[] = [];
  await when('a checker of "foreman" checks both', async () => {
    checks = await Promise.all(proofs.map((proof) => checker.check(request(proof))));
  });

  await then('the first is refused with 401 "the person proof is for "intake", not "foreman""', async () => {
    expect(checks[0]).toEqual(refused(401, 'the person proof is for "intake", not "foreman"'));
  });

  await then('the second is refused with 401 "the person proof does not verify: " and the reason of jose', async () => {
    expect(checks[1]).toEqual(refused(401, 'the person proof does not verify: "nbf" claim timestamp check failed'));
  });
});
