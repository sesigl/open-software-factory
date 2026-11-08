import { scenario } from "@opensoftware/testkit";
import { following, RUN, runEvent } from "./server.ts";

scenario("SCN-INTAKE-043", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server and "INTAKE_DATABASE_URL" set to a PostgreSQL database, received the README\'s "work.json"',
    async () => {
      const db = await fakes.postgres();
      server = await following(sut, fakes, { INTAKE_DATABASE_URL: db.url });
    },
  );

  await given("the server stops", async () => {
    await server.stop();
  });

  await when('the foreman publishes "run.completed@v1" for the work item with the outcome "succeeded"', async () => {
    await server.publish(runEvent(server.id, "succeeded"));
  });

  await when("the server starts again", async () => {
    await server.start();
  });

  await then('"/v1/work-items/<id>" shows the status "complete"', async () => {
    expect(await server.until("complete")).toMatchObject({ status: "complete", runId: RUN });
  });
});
