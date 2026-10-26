import { scenario } from "@opensoftware/testkit";
import { received } from "./server.ts";

scenario("SCN-INTAKE-029", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof received>>;
  await given('the server received the README\'s "work.json"', async () => {
    server = await received(sut, fakes);
  });

  let found: Awaited<ReturnType<typeof server.byKey>>;
  await when('a program gets "/v1/work-items?dedupeKey=idea:export-csv"', async () => {
    found = await server.byKey("idea:export-csv");
  });

  await then('the answer has the status 200 and the work item with the title "Export reports as CSV"', async () => {
    expect(found.status).toBe(200);
    expect(found.view?.workItem).toMatchObject({ id: server.id, title: "Export reports as CSV" });
    expect((await server.byKey("idea:other")).status).toBe(404);
  });
});
