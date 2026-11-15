import { scenario } from "@opensoftware/testkit";
import { proving, workAs } from "./server.ts";

scenario("SCN-INTAKE-070", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof proving>>;
  await given('the server runs with "INTAKE_PERSON_KEYS" set to the key set of the console', async () => {
    server = await proving(sut, fakes);
  });

  let answers: Awaited<ReturnType<typeof server.post>>[] = [];
  await when(
    'the console posts the README\'s "work.json" with the requester "ada@acme.dev" and a proof of "ada@acme.dev" for "foreman", for the path "/v1/runs", for another body, and of "grace@acme.dev"',
    async () => {
      const body = workAs(fakes, { kind: "person", id: "ada@acme.dev" });
      const proofs = await Promise.all([
        server.prove("ada@acme.dev", body, { aud: "foreman" }),
        server.prove("ada@acme.dev", body, { path: "/v1/runs" }),
        server.prove("ada@acme.dev", `${body} `),
        server.prove("grace@acme.dev", body),
      ]);
      answers = await Promise.all(proofs.map((proof) => server.post(body, proof)));
    },
  );

  await then(
    'the answers are 401 for the audience "foreman" and 403 for the path, the body digest and the person, each with the claim',
    async () => {
      expect(answers).toEqual([
        {
          status: 401,
          body: { title: "Unauthorized", status: 401, detail: 'the person proof is for "foreman", not "intake"' },
        },
        {
          status: 403,
          body: {
            title: "Forbidden",
            status: 403,
            detail: 'the person proof\'s path "/v1/runs" is not this request\'s "/v1/work-items"',
          },
        },
        {
          status: 403,
          body: { title: "Forbidden", status: 403, detail: "the person proof's bodyDigest is not this request's body" },
        },
        {
          status: 403,
          body: {
            title: "Forbidden",
            status: 403,
            detail: 'the person proof\'s sub "grace@acme.dev" is not the actor "ada@acme.dev"',
          },
        },
      ]);
    },
  );

  await then('"/v1/work-items?dedupeKey=idea:export-csv" answers 404', async () => {
    expect((await server.byKey("idea:export-csv")).status).toBe(404);
  });
});
