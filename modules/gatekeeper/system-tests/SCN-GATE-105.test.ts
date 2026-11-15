import { scenario } from "@opensoftware/testkit";
import { ADA, checkingServer, decisionBody, person, postDecision } from "./person.ts";

const KEYS = "/.well-known/jwks.json";

scenario("SCN-GATE-105", async ({ sut, fakes, given, when, then }) => {
  let issuer: Awaited<ReturnType<typeof fakes.personIssuer>>;
  let url = "";
  let server: Awaited<ReturnType<typeof checkingServer>>;
  await given(
    'the server checks the person proofs of "console", whose key set answers 500, and asked "maintainers" for approval of the README request',
    async () => {
      const keys = await fakes.http([{ method: "GET", path: KEYS, status: 500, body: { error: "down" } }]);
      issuer = await fakes.personIssuer();
      url = `${keys.url}${KEYS}`;
      server = await checkingServer(sut, fakes, `console=${url}`);
    },
  );

  let answer: Awaited<ReturnType<typeof postDecision>>;
  await when('the console posts the decision "approved" by "ada@acme.dev" with its proof', async () => {
    const body = decisionBody(person(ADA));
    answer = await postDecision(
      server,
      body,
      await issuer.prove({ sub: ADA, aud: "gatekeeper", path: server.path, body }),
    );
  });

  await then(
    `the answer has the status 503 and a problem with the title "The person cannot be checked" that says 'cannot fetch the key set of the issuer "console" at <url>: HTTP 500'`,
    async () => {
      expect(answer.response.status).toBe(503);
      expect(answer.error).toEqual({
        title: "The person cannot be checked",
        status: 503,
        detail: `cannot fetch the key set of the issuer "console" at ${url}: HTTP 500`,
      });
    },
  );

  await then('"/v1/gates/<gate>" still shows the state "pending"', async () => {
    expect(await server.gate(server.id)).toMatchObject({ state: "pending" });
  });
});
