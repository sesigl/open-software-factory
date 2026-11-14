import type { WorkItemList } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { AUTH, readmeWork, serving } from "./server.ts";

scenario("SCN-INTAKE-060", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server received the README\'s "work.json" at "2026-01-01T00:00:00Z"', async () => {
    server = await serving(sut, { OSF_NOW: "2026-01-01T00:00:00Z" });
    expect((await server.submit(readmeWork(fakes))).response.status).toBe(201);
  });

  const ids: Record<string, string> = {};
  await given(
    'it received the submissions "Import reports from CSV" and "Archive old reports" at "2026-01-01T00:05:00Z"',
    async () => {
      await server.restart({ OSF_NOW: "2026-01-01T00:05:00Z" });
      for (const [title, dedupeKey] of [
        ["Import reports from CSV", "idea:import-csv"],
        ["Archive old reports", "idea:archive"],
      ] as const) {
        const answer = await server.submit({ ...readmeWork(fakes), title, dedupeKey });
        expect(answer.response.status).toBe(201);
        ids[title] = (answer.data as { workItem: { id: string } }).workItem.id;
      }
    },
  );

  const pages: WorkItemList[] = [];
  await when(
    'a program reads "/v1/inbox?limit=1" and then the page of each "next" cursor with the API token',
    async () => {
      let path: string | undefined = "/v1/inbox?limit=1";
      while (path && pages.length < 4) {
        const answer = await sut.http.request("GET", path, { headers: AUTH });
        expect(answer.status).toBe(200);
        const page = answer.body as WorkItemList;
        pages.push(page);
        path = page.next && `/v1/inbox?limit=1&cursor=${page.next}`;
      }
    },
  );

  await then(
    'the three pages list one work item each, the two received last first, in the order of their IDs, then "Export reports as CSV"',
    async () => {
      const later = Object.entries(ids)
        .sort(([, a], [, b]) => a.localeCompare(b))
        .map(([title]) => title);
      expect(pages.map((page) => page.workItems.map(({ workItem }) => workItem.title))).toEqual([
        [later[0]],
        [later[1]],
        ["Export reports as CSV"],
      ]);
    },
  );

  await then('only the last page names no "next" cursor', async () => {
    expect(pages.map((page) => typeof page.next)).toEqual(["string", "string", "undefined"]);
  });
});
