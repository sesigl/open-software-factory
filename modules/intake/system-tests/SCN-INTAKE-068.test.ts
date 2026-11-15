import { scenario } from "@opensoftware/testkit";
import { proving, workAs } from "./server.ts";

scenario("SCN-INTAKE-068", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof proving>>;
  await given('the server runs with "INTAKE_PERSON_KEYS" set to the key set of the console', async () => {
    server = await proving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.post>>;
  await when(
    'a program posts the README\'s "work.json" with the API token and the requester "grace@acme.dev" without "OSF-Person"',
    async () => {
      answer = await server.post(workAs(fakes, { kind: "person", id: "grace@acme.dev" }));
    },
  );

  await then(
    'the answer has the status 401 and the problem "Unauthorized" with the detail "send OSF-Person: the console\'s proof of the person (ADR 0151)"',
    async () => {
      expect(answer).toEqual({
        status: 401,
        body: {
          title: "Unauthorized",
          status: 401,
          detail: "send OSF-Person: the console's proof of the person (ADR 0151)",
        },
      });
    },
  );

  await then('"/v1/work-items?dedupeKey=idea:export-csv" answers 404', async () => {
    expect((await server.byKey("idea:export-csv")).status).toBe(404);
  });
});
