import { scenario } from "@opensoftware/testkit";
import { following, RUN_AGAIN, rerunEvent, runEvent } from "./server.ts";

scenario("SCN-INTAKE-050", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server knows that the run "run_5d41402abc4b2a76b971" of the README\'s "work.json" completed with the outcome "failed"',
    async () => {
      server = await following(sut, fakes);
      await server.publish(runEvent(server.id, "failed"));
      await server.until("failed");
    },
  );

  await when(
    'the foreman publishes "run.started@v1" for the work item with the run "run_0f3c7e91a2b44d6e8c05" and the "retryOf" "run_5d41402abc4b2a76b971"',
    async () => {
      await server.publish(rerunEvent(runEvent(server.id)));
    },
  );

  await then('"/v1/work-items/<id>" shows the status "running" and the run "run_0f3c7e91a2b44d6e8c05"', async () => {
    expect(await server.until("running")).toMatchObject({ status: "running", runId: RUN_AGAIN });
  });
});
