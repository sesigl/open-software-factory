import { scenario } from "@opensoftware/testkit";
import { ADA, checkingServer, decisionBody, person, postDecision } from "./person.ts";

const MISSING = "send OSF-Person: the console's proof of the person (ADR 0151)";

scenario("SCN-GATE-099", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof checkingServer>>;
  await given(
    'the server checks the console\'s person proofs and asked "maintainers", whose member is "ada@acme.dev", for approval of the README request',
    async () => {
      server = await checkingServer(sut, fakes, (await fakes.personIssuer()).setting);
    },
  );

  let answers: Awaited<ReturnType<typeof postDecision>>[] = [];
  await when(
    'a program posts with the API token and without "OSF-Person" the decision "approved" by the person "ada@acme.dev", the decision "approved" by the trigger "tool:acme-portal" and the decision "maybe" by "ada@acme.dev"',
    async () => {
      answers = await Promise.all([
        postDecision(server, decisionBody(person(ADA))),
        postDecision(server, decisionBody({ kind: "trigger", id: "tool:acme-portal" })),
        postDecision(server, decisionBody(person(ADA), "maybe")),
      ]);
    },
  );

  await then("the answers have the statuses 401, 401 and 400", async () => {
    expect(answers.map(({ response }) => response.status)).toEqual([401, 401, 400]);
  });

  await then(
    'the first two problems have the title "The person is not proven" and say "send OSF-Person: the console\'s proof of the person (ADR 0151)"',
    async () => {
      expect(answers.slice(0, 2).map(({ error }) => error)).toEqual([
        { title: "The person is not proven", status: 401, detail: MISSING },
        { title: "The person is not proven", status: 401, detail: MISSING },
      ]);
    },
  );

  await then('"/v1/gates/<gate>" still shows the state "pending"', async () => {
    expect(await server.gate(server.id)).toMatchObject({ state: "pending" });
  });
});
