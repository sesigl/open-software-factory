import type { PersonCheck, PersonChecker } from "@opensoftware/person-proof";
import { scenario } from "@opensoftware/testkit";
import { CLAIMS, foremanOf, refused, request } from "./proof.ts";

scenario("SCN-PPROOF-014", async ({ fakes, given, when, then }) => {
  let checker: PersonChecker;
  let proof = "";
  await given('a proof for "foreman" without "sub" and "bodyDigest" and with the role "owner"', async () => {
    const foreman = await foremanOf(fakes);
    checker = foreman.checker;
    proof = await foreman.issuer.prove({ ...CLAIMS, sub: undefined, role: "owner", bodyDigest: undefined });
  });

  let check: PersonCheck;
  await when('a checker of "foreman" checks it for the person "ada@acme.dev"', async () => {
    check = await checker.check(request(proof));
  });

  await then(
    'it is refused with 401 "the person proof\'s claims are not valid person-proof: " and each problem with its path, and the claimed "ada@acme.dev"',
    async () => {
      expect(check).toEqual(
        refused(
          401,
          'the person proof\'s claims are not valid person-proof: /sub missing required field; /bodyDigest missing required field; /role must be one of "member", "factory-engineer", "admin"',
        ),
      );
    },
  );
});
