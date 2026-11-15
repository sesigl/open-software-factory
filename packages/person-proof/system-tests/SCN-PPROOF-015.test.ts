import type { PersonCheck, PersonChecker } from "@opensoftware/person-proof";
import { scenario } from "@opensoftware/testkit";
import { CLAIMS, foremanOf, PATH, refused, request } from "./proof.ts";

scenario("SCN-PPROOF-015", async ({ fakes, given, when, then }) => {
  let checker: PersonChecker;
  let proof = "";
  await given('a proof of "ada@acme.dev" for "POST /v1/runs/run_1/signals" of "foreman" with a body', async () => {
    const foreman = await foremanOf(fakes);
    checker = foreman.checker;
    proof = await foreman.issuer.prove(CLAIMS);
  });

  let checks: PersonCheck[] = [];
  await when(
    'a checker of "foreman" checks it in the header "osf-person" of "PUT" on that path, of "POST" on "/v1/runs/run_2/signals", of another body, and for the person "varun@acme.dev"',
    async () => {
      const headers = { "osf-person": proof };
      checks = await Promise.all(
        [
          { method: "PUT" },
          { path: "/v1/runs/run_2/signals" },
          { body: '{"signal":"cancel"}' },
          { actor: { kind: "person" as const, id: "varun@acme.dev" } },
        ].map((changes) => checker.check(request("", { headers, ...changes }))),
      );
    },
  );

  await then(
    'each is refused with 403: the method "POST" is not "PUT", the path is not "/v1/runs/run_2/signals", the bodyDigest is not the body\'s, and the sub "ada@acme.dev" is not the actor "varun@acme.dev"',
    async () => {
      expect(checks).toEqual([
        refused(403, `the person proof's method "POST" is not this request's "PUT"`),
        refused(403, `the person proof's path "${PATH}" is not this request's "/v1/runs/run_2/signals"`),
        refused(403, "the person proof's bodyDigest is not this request's body"),
        refused(403, `the person proof's sub "ada@acme.dev" is not the actor "varun@acme.dev"`),
      ]);
    },
  );

  await then('each names the claimed "ada@acme.dev"', async () => {
    expect(checks.map((check) => !check.ok && check.sub)).toEqual(Array(4).fill("ada@acme.dev"));
  });
});
