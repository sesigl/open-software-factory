import { scenario } from "@opensoftware/testkit";
import { checkingServer, decisionBody, detailOf, GRACE, person, postDecision } from "./person.ts";

scenario("SCN-GATE-102", async ({ sut, fakes, given, when, then }) => {
  let issuers: Awaited<ReturnType<typeof fakes.personIssuer>>[] = [];
  let server: Awaited<ReturnType<typeof checkingServer>>;
  await given(
    'the server checks the person proofs of "console" and of the team\'s tool "acme-portal" and asked "maintainers", whose member is "grace@acme.dev", for approval of the README request',
    async () => {
      issuers = await Promise.all([
        fakes.personIssuer(),
        fakes.personIssuer({ name: "acme-portal" }),
        fakes.personIssuer({ name: "other-tool" }),
      ]);
      const setting = issuers
        .slice(0, 2)
        .map((issuer) => issuer.setting)
        .join(",");
      server = await checkingServer(sut, fakes, setting, GRACE);
    },
  );

  let answers: Awaited<ReturnType<typeof postDecision>>[] = [];
  await when(
    'the issuer "other-tool" posts the decision "approved" by "grace@acme.dev" with its proof, and then "acme-portal" does the same with its proof',
    async () => {
      const body = decisionBody(person(GRACE));
      const claims = { sub: GRACE, aud: "gatekeeper", path: server.path, body };
      const [, tool, other] = issuers;
      const refused = await postDecision(server, body, await other?.prove(claims));
      answers = [refused, await postDecision(server, body, await tool?.prove(claims))];
    },
  );

  await then(
    `the first answer has the status 401 and a problem that says 'the person proof's issuer "other-tool" is not one of "console", "acme-portal"'`,
    async () => {
      expect(answers[0]?.response.status).toBe(401);
      expect(detailOf(answers[0] ?? {})).toBe(
        `the person proof's issuer "other-tool" is not one of "console", "acme-portal"`,
      );
    },
  );

  await then(
    'the second answer shows the state "approved" and a record approved by the person "grace@acme.dev"',
    async () => {
      expect(answers[1]?.response.status).toBe(200);
      expect(answers[1]?.data).toMatchObject({
        state: "approved",
        record: { decision: "approved", decidedBy: { kind: "person", id: GRACE } },
      });
    },
  );
});
