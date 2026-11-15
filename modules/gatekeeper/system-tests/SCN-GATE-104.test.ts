import { scenario } from "@opensoftware/testkit";
import { decisionBody, person, postDecision } from "./person.ts";
import { askedServer } from "./server.ts";

const UNSET =
  "gatekeeper: GATEKEEPER_PERSON_KEYS is not set, so a caller with GATEKEEPER_API_TOKEN decides a gate as any person it names (ADR 0151)\n";

scenario("SCN-GATE-104", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given(
    'the server runs without "GATEKEEPER_PERSON_KEYS" and asked "maintainers" for approval of the README request',
    async () => {
      server = await askedServer(sut, fakes);
    },
  );

  let answer: Awaited<ReturnType<typeof postDecision>>;
  await when(
    'a program posts with the API token and without "OSF-Person" the decision "approved" by the person "slack:U0ADA"',
    async () => {
      answer = await postDecision(server, decisionBody(person("slack:U0ADA")));
    },
  );

  await then('the answer shows the state "approved" and a record approved by the person "slack:U0ADA"', async () => {
    expect(answer.response.status).toBe(200);
    expect(answer.data).toMatchObject({
      state: "approved",
      record: { decision: "approved", decidedBy: { kind: "person", id: "slack:U0ADA" } },
    });
  });

  await then(
    `the server's error output says once "gatekeeper: GATEKEEPER_PERSON_KEYS is not set, so a caller with GATEKEEPER_API_TOKEN decides a gate as any person it names (ADR 0151)"`,
    async () => {
      expect(sut.http.output().stderr.split(UNSET)).toHaveLength(2);
    },
  );
});
