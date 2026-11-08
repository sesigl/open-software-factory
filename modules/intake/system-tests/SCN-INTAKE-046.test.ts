import type { WorkItemList } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { AUTH, readmeWork, serving } from "./server.ts";

scenario("SCN-INTAKE-046", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server received the README\'s "work.json" at "2026-01-01T00:00:00Z"', async () => {
    server = await serving(sut, { OSF_NOW: "2026-01-01T00:00:00Z" });
    expect((await server.submit(readmeWork(fakes))).response.status).toBe(201);
  });

  await given(
    'it received a submission with the title "Import reports from CSV" at "2026-01-01T00:05:00Z"',
    async () => {
      await server.restart({ OSF_NOW: "2026-01-01T00:05:00Z" });
      const other = { ...readmeWork(fakes), title: "Import reports from CSV", dedupeKey: "idea:import-csv" };
      expect((await server.submit(other)).response.status).toBe(201);
    },
  );

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/inbox" with the API token', async () => {
    answer = await sut.http.request("GET", "/v1/inbox", { headers: AUTH });
  });

  await then(
    'the answer lists the work items "Import reports from CSV" and "Export reports as CSV", in this order, each with its status "received"',
    async () => {
      expect(answer.status).toBe(200);
      const { workItems } = answer.body as WorkItemList;
      expect(workItems.map(({ workItem, status }) => [workItem.title, status])).toEqual([
        ["Import reports from CSV", "received"],
        ["Export reports as CSV", "received"],
      ]);
      expect(workItems.map(({ receivedAt }) => receivedAt)).toEqual([
        "2026-01-01T00:05:00.000Z",
        "2026-01-01T00:00:00.000Z",
      ]);
    },
  );
});
