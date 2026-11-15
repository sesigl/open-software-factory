import { scenario } from "@opensoftware/testkit";
import { proving, workAs } from "./server.ts";

scenario("SCN-INTAKE-072", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof proving>>;
  await given('the server runs with "INTAKE_PERSON_KEYS" set to the key set of the console', async () => {
    server = await proving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.post>>;
  await when(
    'a program posts the README\'s "work.json" with the API token and the requester of the kind "trigger" "tool:acme-portal"',
    async () => {
      answer = await server.post(workAs(fakes, { kind: "trigger", id: "tool:acme-portal" }));
    },
  );

  await then("the answer has the status 201", async () => {
    expect(answer.status, JSON.stringify(answer.body)).toBe(201);
  });

  await then('"/v1/work-items/<id>" shows the requester of the kind "trigger" "tool:acme-portal"', async () => {
    const { workItem } = answer.body as { workItem: { id: string } };
    expect((await server.workItem(workItem.id))?.workItem.requester).toEqual({
      kind: "trigger",
      id: "tool:acme-portal",
    });
  });
});
