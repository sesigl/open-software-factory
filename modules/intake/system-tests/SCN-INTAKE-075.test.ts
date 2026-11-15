import { scenario } from "@opensoftware/testkit";
import { postWork, serving, workAs } from "./server.ts";

scenario("SCN-INTAKE-075", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server runs without "INTAKE_PERSON_KEYS"', async () => {
    server = await serving(sut);
  });

  let answer: Awaited<ReturnType<typeof postWork>>;
  await when(
    'a program posts the README\'s "work.json" with the API token and the requester "grace@acme.dev" without "OSF-Person"',
    async () => {
      answer = await postWork(server.url, workAs(fakes, { kind: "person", id: "grace@acme.dev" }));
    },
  );

  await then("the answer has the status 201", async () => {
    expect(answer.status, JSON.stringify(answer.body)).toBe(201);
  });

  await then(
    'the error output says once "INTAKE_PERSON_KEYS is not set: a caller with the API token names any person (ADR 0151)"',
    async () => {
      expect(sut.http.output().stderr.match(/^intake: .*INTAKE_PERSON_KEYS.*$/gm)).toEqual([
        "intake: INTAKE_PERSON_KEYS is not set: a caller with the API token names any person (ADR 0151)",
      ]);
    },
  );
});
