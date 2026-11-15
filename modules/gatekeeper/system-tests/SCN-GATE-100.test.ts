import { scenario } from "@opensoftware/testkit";
import { ADA, checkingServer, decisionBody, detailOf, person, postDecision } from "./person.ts";

/** 2025-12-31T23:58:20Z: the proof lives 30 seconds, so it ended 70 seconds before the testkit's clock. */
const SIGNED = Date.parse("2025-12-31T23:58:20Z") / 1000;
const ENDED = "the person proof ended at 2025-12-31T23:58:50Z";

scenario("SCN-GATE-100", async ({ sut, fakes, given, when, then }) => {
  let issuer: Awaited<ReturnType<typeof fakes.personIssuer>>;
  let server: Awaited<ReturnType<typeof checkingServer>>;
  await given(
    'the server checks the console\'s person proofs and asked "maintainers", whose member is "ada@acme.dev", for approval of the README request',
    async () => {
      issuer = await fakes.personIssuer();
      server = await checkingServer(sut, fakes, issuer.setting);
    },
  );

  let proof = "";
  let answer: Awaited<ReturnType<typeof postDecision>>;
  await when(
    'the console posts the decision "approved" by "ada@acme.dev" with a proof that ended at 2025-12-31T23:58:50Z',
    async () => {
      const body = decisionBody(person(ADA));
      proof = await issuer.prove({ sub: ADA, aud: "gatekeeper", path: server.path, body, iat: SIGNED });
      answer = await postDecision(server, body, proof);
    },
  );

  await then(
    'the answer has the status 401 and a problem that says "the person proof ended at 2025-12-31T23:58:50Z"',
    async () => {
      expect(answer.response.status).toBe(401);
      expect(detailOf(answer)).toBe(ENDED);
    },
  );

  await then(
    `the server's error output says 'gatekeeper: refused POST /v1/gates/<gate>/decisions for "ada@acme.dev": the person proof ended at 2025-12-31T23:58:50Z'`,
    async () => {
      expect(sut.http.output().stderr).toContain(`gatekeeper: refused POST ${server.path} for "${ADA}": ${ENDED}\n`);
    },
  );

  await then("the server's error output does not hold the proof", async () => {
    expect(sut.http.output().stderr).not.toContain(proof.split(".")[2]);
  });

  await then('"/v1/gates/<gate>" still shows the state "pending"', async () => {
    expect(await server.gate(server.id)).toMatchObject({ state: "pending" });
  });
});
