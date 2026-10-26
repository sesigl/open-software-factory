import { scenario } from "@opensoftware/testkit";
import { following, RUN, runEvent } from "./server.ts";

scenario("SCN-INTAKE-030", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, received the README\'s "work.json"',
    async () => {
      server = await following(sut, fakes);
    },
  );

  await when(
    'the foreman publishes "run.started@v1" for the work item with the run "run_5d41402abc4b2a76b971"',
    async () => {
      await server.publish(runEvent(server.id));
    },
  );

  await then('"/v1/work-items/<id>" shows the status "running" and the run "run_5d41402abc4b2a76b971"', async () => {
    const view = await server.until("running");
    expect(view).toMatchObject({ status: "running", runId: RUN, workItem: { id: server.id } });
  });
});
