import { type PersonCheck, type PersonChecker, personChecker } from "@opensoftware/person-proof";
import type { FakePersonIssuer } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { ADA, at, CLAIMS, refused, request } from "./proof.ts";

scenario("SCN-PPROOF-010", async ({ fakes, given, when, then }) => {
  let signIn: FakePersonIssuer;
  let tool: FakePersonIssuer;
  let checker: PersonChecker;
  await given(
    'a checker of "foreman" with the setting "console=<url>, acme-portal=<url of the tool\'s key set>"',
    async () => {
      signIn = await fakes.personIssuer();
      tool = await fakes.personIssuer({ name: "acme-portal" });
      checker = personChecker(`${signIn.setting}, ${tool.setting}`, { audience: "foreman", now: at(0) });
    },
  );

  let checks: PersonCheck[] = [];
  await when(
    'it checks a proof of the issuer "other" and a proof that the tool "acme-portal" signed with its own key',
    async () => {
      const proofs = await Promise.all([signIn.prove({ ...CLAIMS, iss: "other" }), tool.prove(CLAIMS)]);
      checks = await Promise.all(proofs.map((proof) => checker.check(request(proof))));
    },
  );

  await then(
    'the first is refused with 401 "the person proof\'s issuer "other" is not one of "console", "acme-portal""',
    async () => {
      expect(checks[0]).toEqual(
        refused(401, 'the person proof\'s issuer "other" is not one of "console", "acme-portal"'),
      );
    },
  );

  await then("the tool's gives the person", async () => {
    expect(checks[1]).toMatchObject({ ok: true, actor: ADA, proof: { iss: "acme-portal" } });
    expect(tool.fetched()).toBe(1);
    expect(signIn.fetched()).toBe(0);
  });
});
