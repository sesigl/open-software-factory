import type { PersonCheck, PersonChecker } from "@opensoftware/person-proof";
import { scenario } from "@opensoftware/testkit";
import { foremanOf, refused, request } from "./proof.ts";

scenario("SCN-PPROOF-013", async ({ fakes, given, when, then }) => {
  let checker: PersonChecker;
  await given('a checker of "foreman" with the setting of an issuer', async () => {
    ({ checker } = await foremanOf(fakes));
  });

  let check: PersonCheck;
  await when('it checks the header "OSF-Person: not-a-token" for the person "varun@acme.dev"', async () => {
    check = await checker.check(request("not-a-token", { actor: { kind: "person", id: "varun@acme.dev" } }));
  });

  await then(
    'it is refused with 401 "the person proof is not a JSON Web Token" and the claimed "varun@acme.dev"',
    async () => {
      expect(check).toEqual(refused(401, "the person proof is not a JSON Web Token", "varun@acme.dev"));
    },
  );
});
