import { scenario } from "@opensoftware/testkit";
import { proving, workAs } from "./server.ts";

scenario("SCN-INTAKE-067", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof proving>>;
  await given('the server runs with "INTAKE_PERSON_KEYS" set to the key set of the console', async () => {
    server = await proving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.post>>;
  await when(
    'the console posts the README\'s "work.json" with the requester "ada@acme.dev" named "Ada" and its proof of "ada@acme.dev" named "Ada Lovelace"',
    async () => {
      const body = workAs(fakes, { kind: "person", id: "ada@acme.dev", displayName: "Ada" });
      answer = await server.post(body, await server.prove("ada@acme.dev", body, { name: "Ada Lovelace" }));
    },
  );

  await then("the answer has the status 201", async () => {
    expect(answer.status, JSON.stringify(answer.body)).toBe(201);
  });

  await then(
    '"/v1/work-items/<id>" shows the requester "ada@acme.dev" with the name "Ada Lovelace" of the proof',
    async () => {
      const { workItem } = answer.body as { workItem: { id: string } };
      const view = await server.workItem(workItem.id);
      const person = { kind: "person", id: "ada@acme.dev", displayName: "Ada Lovelace" };
      expect(view?.workItem.requester).toEqual(person);
      expect(view?.requests.map((request) => request.requester)).toEqual([person]);
    },
  );
});
