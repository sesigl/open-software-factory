import { type PersonCheck, personChecker } from "@opensoftware/person-proof";
import type { FakePersonIssuer } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { ADA, at, CLAIMS, refused, request } from "./proof.ts";

scenario("SCN-PPROOF-006", async ({ fakes, given, when, then }) => {
  let issuer: FakePersonIssuer;
  let proof = "";
  await given(
    'a proof of "ada@acme.dev" for "foreman" signed at 2026-01-01T00:00:00Z that ends 30 seconds later',
    async () => {
      issuer = await fakes.personIssuer();
      proof = await issuer.prove(CLAIMS);
    },
  );

  let checks: PersonCheck[] = [];
  await when('a checker of "foreman" checks it at 00:00:39 and at 00:00:41', async () => {
    checks = await Promise.all(
      [39, 41].map((seconds) =>
        personChecker(issuer.setting, { audience: "foreman", now: at(seconds) }).check(request(proof)),
      ),
    );
  });

  await then("the first gives the person", async () => {
    expect(checks[0]).toMatchObject({ ok: true, actor: ADA });
  });

  await then('the second is refused with 401 "the person proof ended at 2026-01-01T00:00:30Z"', async () => {
    expect(checks[1]).toEqual(refused(401, "the person proof ended at 2026-01-01T00:00:30Z"));
  });
});
