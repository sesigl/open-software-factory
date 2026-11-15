import type { PersonCheck, PersonChecker } from "@opensoftware/person-proof";
import type { FakePersonIssuer } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { ADA, CLAIMS, foremanOf, IAT, refused, request } from "./proof.ts";

scenario("SCN-PPROOF-007", async ({ fakes, given, when, then }) => {
  let issuer: FakePersonIssuer;
  let checker: PersonChecker;
  let proofs: string[] = [];
  await given(
    'proofs of "ada@acme.dev" for "foreman" signed at 2026-01-01T00:00:10Z and at 2026-01-01T00:00:11Z',
    async () => {
      ({ issuer, checker } = await foremanOf(fakes));
      proofs = await Promise.all([10, 11].map((ahead) => issuer.prove({ ...CLAIMS, iat: IAT + ahead })));
    },
  );

  let checks: PersonCheck[] = [];
  await when('a checker of "foreman" checks each at 2026-01-01T00:00:00Z', async () => {
    checks = await Promise.all(proofs.map((proof) => checker.check(request(proof))));
  });

  await then("the first gives the person", async () => {
    expect(checks[0]).toMatchObject({ ok: true, actor: ADA });
  });

  await then(
    'the second is refused with 401 "the person proof was signed at 2026-01-01T00:00:11Z, after 2026-01-01T00:00:00.000Z"',
    async () => {
      expect(checks[1]).toEqual(
        refused(401, "the person proof was signed at 2026-01-01T00:00:11Z, after 2026-01-01T00:00:00.000Z"),
      );
    },
  );
});
