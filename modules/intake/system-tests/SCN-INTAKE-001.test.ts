import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./server.ts";

scenario("SCN-INTAKE-001", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('"intake serve" runs with the README\'s "INTAKE_API_TOKEN" and no database', async () => {
    server = await serving(sut);
  });

  let answer: Awaited<ReturnType<typeof server.submit>>;
  await when('a program posts the README\'s "work.json" to "/v1/work-items" with the API token', async () => {
    answer = await server.submit(readmeWork(fakes));
  });

  await then('the answer has the status 201 and a work item "wi_" in the state "received"', async () => {
    expect(answer.response.status, JSON.stringify(answer.error)).toBe(201);
    expect(answer.data?.workItem.id).toMatch(/^wi_[0-9a-f]{20}$/);
    expect(answer.data).toMatchObject({ status: "received", receivedAt: "2026-01-01T00:00:00.000Z" });
  });

  await then(
    '"/v1/work-items/<id>" shows the work item with the title "Export reports as CSV" from the origin "api"',
    async () => {
      const view = await server.workItem(answer.data?.workItem.id as string);
      expect(view?.workItem).toMatchObject({ title: "Export reports as CSV", type: "idea", origin: { source: "api" } });
      expect(view?.requests).toEqual([
        {
          requester: { kind: "person", id: "slack:U0PERSON", displayName: "Varun" },
          origin: { source: "api" },
          receivedAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
    },
  );
});
