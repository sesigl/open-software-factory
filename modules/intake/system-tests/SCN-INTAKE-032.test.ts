import { scenario } from "@opensoftware/testkit";
import { following, RUN, runEvent } from "./server.ts";

scenario("SCN-INTAKE-032", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, received the README\'s "work.json"',
    async () => {
      server = await following(sut, fakes);
    },
  );

  await when('the foreman publishes "run.completed@v1" for the work item with the outcome "failed"', async () => {
    await server.publish(runEvent(server.id, "failed"));
  });

  await then('"/v1/work-items/<id>" shows the status "failed"', async () => {
    expect(await server.until("failed")).toMatchObject({ status: "failed", runId: RUN });
  });
});
