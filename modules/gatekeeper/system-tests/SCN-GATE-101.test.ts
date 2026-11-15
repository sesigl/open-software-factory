import { scenario } from "@opensoftware/testkit";
import { ADA, checkingServer, decisionBody, detailOf, GRACE, person, postDecision } from "./person.ts";

const OTHER_PATH = "/v1/gates/g0000000000000000/decisions";

scenario("SCN-GATE-101", async ({ sut, fakes, given, when, then }) => {
  let issuer: Awaited<ReturnType<typeof fakes.personIssuer>>;
  let server: Awaited<ReturnType<typeof checkingServer>>;
  await given(
    'the server checks the console\'s person proofs and asked "maintainers", whose member is "ada@acme.dev", for approval of the README request',
    async () => {
      issuer = await fakes.personIssuer();
      server = await checkingServer(sut, fakes, issuer.setting);
    },
  );

  let answers: Awaited<ReturnType<typeof postDecision>>[] = [];
  await when(
    'the console posts the decision "approved" by "ada@acme.dev" with a proof for "foreman", for the path "/v1/gates/g0000000000000000/decisions", for the decision "rejected" and for "grace@acme.dev"',
    async () => {
      const body = decisionBody(person(ADA));
      const claims = { sub: ADA, aud: "gatekeeper", path: server.path, body };
      const proofs = await Promise.all([
        issuer.prove({ ...claims, aud: "foreman" }),
        issuer.prove({ ...claims, path: OTHER_PATH }),
        issuer.prove({ ...claims, body: decisionBody(person(ADA), "rejected") }),
        issuer.prove({ ...claims, sub: GRACE }),
      ]);
      answers = await Promise.all(proofs.map((proof) => postDecision(server, body, proof)));
    },
  );

  await then("the answers have the statuses 401, 403, 403 and 403", async () => {
    expect(answers.map(({ response }) => response.status)).toEqual([401, 403, 403, 403]);
  });

  await then(
    `their problems say 'the person proof is for "foreman", not "gatekeeper"', 'the person proof's path "/v1/gates/g0000000000000000/decisions" is not this request's "/v1/gates/<gate>/decisions"', "the person proof's bodyDigest is not this request's body" and 'the person proof's sub "grace@acme.dev" is not the actor "ada@acme.dev"'`,
    async () => {
      expect(answers.map(detailOf)).toEqual([
        'the person proof is for "foreman", not "gatekeeper"',
        `the person proof's path "${OTHER_PATH}" is not this request's "${server.path}"`,
        "the person proof's bodyDigest is not this request's body",
        `the person proof's sub "${GRACE}" is not the actor "${ADA}"`,
      ]);
    },
  );

  await then('"/v1/gates/<gate>" still shows the state "pending"', async () => {
    expect(await server.gate(server.id)).toMatchObject({ state: "pending" });
  });
});
