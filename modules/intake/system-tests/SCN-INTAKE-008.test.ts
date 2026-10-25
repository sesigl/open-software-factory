import { scenario } from "@opensoftware/testkit";
import { received } from "./server.ts";

scenario("SCN-INTAKE-008", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof received>>;
  await given(
    'the server, with "INTAKE_DATABASE_URL" set to a PostgreSQL database, received the README\'s "work.json"',
    async () => {
      const db = await fakes.postgres();
      server = await received(sut, fakes, { INTAKE_DATABASE_URL: db.url });
    },
  );

  await when("the server starts again on the same database", async () => {
    await server.restart();
  });

  await then('"/v1/work-items/<id>" shows the work item with the title "Export reports as CSV"', async () => {
    const view = await server.workItem(server.id);
    expect(view?.workItem).toMatchObject({ id: server.id, title: "Export reports as CSV" });
    expect(view?.requests).toHaveLength(1);
  });
});
