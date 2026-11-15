import type { PersonCheck, PersonChecker } from "@opensoftware/person-proof";
import { scenario } from "@opensoftware/testkit";
import { foremanOf, refused, request } from "./proof.ts";

const MISSING = "send OSF-Person: the console's proof of the person (ADR 0151)";
const TOOL = { kind: "trigger", id: "tool:acme-portal" } as const;

scenario("SCN-PPROOF-005", async ({ fakes, given, when, then }) => {
  let checker: PersonChecker;
  await given('a checker of "foreman" with the setting of an issuer', async () => {
    ({ checker } = await foremanOf(fakes));
  });

  let checks: PersonCheck[] = [];
  await when(
    'it checks a request without "OSF-Person" for the person "varun@acme.dev", one for the trigger "tool:acme-portal", and one for that trigger that always needs a proof',
    async () => {
      checks = await Promise.all([
        checker.check(request("", { headers: {}, actor: { kind: "person", id: "varun@acme.dev" } })),
        checker.check(request("", { headers: {}, actor: TOOL })),
        checker.check(request("", { headers: { accept: "application/json" }, actor: TOOL, always: true })),
      ]);
    },
  );

  await then(
    'the person\'s is refused with 401 "send OSF-Person: the console\'s proof of the person (ADR 0151)" and the claimed "varun@acme.dev"',
    async () => {
      expect(checks[0]).toEqual(refused(401, MISSING, "varun@acme.dev"));
    },
  );

  await then("the trigger's gives the trigger as it was named", async () => {
    expect(checks[1]).toEqual({ ok: true, actor: TOOL });
  });

  await then("the one that always needs a proof is refused with 401 and the same reason", async () => {
    expect(checks[2]).toEqual(refused(401, MISSING, TOOL.id));
  });
});
