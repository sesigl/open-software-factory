import type { PersonCheck, PersonChecker } from "@opensoftware/person-proof";
import type { FakePersonIssuer } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { ADA, CLAIMS, foremanOf, IAT, refused, request } from "./proof.ts";

scenario("SCN-PPROOF-008", async ({ fakes, given, when, then }) => {
  let issuer: FakePersonIssuer;
  let checker: PersonChecker;
  let proofs: string[] = [];
  await given(
    'proofs of "ada@acme.dev" for "foreman" signed at 2026-01-01T00:00:00Z that end 60 and 61 seconds later',
    async () => {
      ({ issuer, checker } = await foremanOf(fakes));
      proofs = await Promise.all([60, 61].map((lives) => issuer.prove({ ...CLAIMS, exp: IAT + lives })));
    },
  );

  let checks: PersonCheck[] = [];
  await when('a checker of "foreman" checks each at that time', async () => {
    checks = await Promise.all(proofs.map((proof) => checker.check(request(proof))));
  });

  await then("the first gives the person", async () => {
    expect(checks[0]).toMatchObject({ ok: true, actor: ADA });
  });

  await then('the second is refused with 401 "the person proof lives 61 seconds, longer than 60"', async () => {
    expect(checks[1]).toEqual(refused(401, "the person proof lives 61 seconds, longer than 60"));
  });
});
