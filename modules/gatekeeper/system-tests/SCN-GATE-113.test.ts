import { scenario } from "@opensoftware/testkit";
import { decisionBody, person, postDecision } from "./person.ts";
import { askedServer } from "./server.ts";

const UNSIGNED =
  "gatekeeper: GATEKEEPER_SIGNING_KEY is not set, so the approval records are not signed: set it to 64 hex digits, like the output of openssl rand -hex 32\n";

scenario("SCN-GATE-113", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given(
    'the server runs without "GATEKEEPER_SIGNING_KEY" and asked "maintainers" for approval of the README request',
    async () => {
      server = await askedServer(sut, fakes);
    },
  );

  let answer: Awaited<ReturnType<typeof postDecision>>;
  await when('a program posts with the API token the decision "approved" by the person "slack:U0ADA"', async () => {
    answer = await postDecision(server, decisionBody(person("slack:U0ADA")));
  });

  await then('the answer shows the state "approved" and a record without a signature', async () => {
    expect(answer.response.status).toBe(200);
    expect(answer.data).toMatchObject({ state: "approved", record: { decision: "approved" } });
    expect((answer.data as { record?: object } | undefined)?.record).not.toHaveProperty("signature");
  });

  await then(
    `the server's error output says once "gatekeeper: GATEKEEPER_SIGNING_KEY is not set, so the approval records are not signed: set it to 64 hex digits, like the output of openssl rand -hex 32"`,
    async () => {
      expect(sut.http.output().stderr.split(UNSIGNED)).toHaveLength(2);
    },
  );
});
