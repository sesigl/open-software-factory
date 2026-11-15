import { type FakePersonIssuer, scenario } from "@opensoftware/testkit";
import { ADA, checkingServer, decisionBody, person, postDecision } from "./person.ts";

const RECORD = { decision: "approved", decidedBy: { kind: "person", id: ADA, displayName: "Ada" } };

scenario("SCN-GATE-098", async ({ sut, fakes, given, when, then }) => {
  let issuer: FakePersonIssuer;
  let server: Awaited<ReturnType<typeof checkingServer>>;
  await given(
    'the server checks the console\'s person proofs and asked "maintainers", whose member is "ada@acme.dev", for approval of the README request',
    async () => {
      issuer = await fakes.personIssuer();
      server = await checkingServer(sut, fakes, issuer.setting);
    },
  );

  let answer: Awaited<ReturnType<typeof postDecision>>;
  await when(
    'the console posts to "/v1/gates/<gate>/decisions" the decision "approved" by "ada@acme.dev" as indented JSON, with its proof for "ada@acme.dev" named "Ada"',
    async () => {
      const body = decisionBody(person(ADA));
      const proof = await issuer.prove({ sub: ADA, name: "Ada", aud: "gatekeeper", path: server.path, body });
      answer = await postDecision(server, body, proof);
    },
  );

  await then(
    'the answer shows the state "approved" and a record approved by the person "ada@acme.dev" with the name "Ada"',
    async () => {
      expect(answer.response.status).toBe(200);
      expect(answer.data).toMatchObject({ id: server.id, state: "approved", record: RECORD });
    },
  );

  await then('"/v1/gates/<gate>" shows the same record', async () => {
    expect(await server.gate(server.id)).toMatchObject({ state: "approved", record: RECORD });
  });
});
