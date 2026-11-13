import { scenario } from "@opensoftware/testkit";
import { following, RUN_AGAIN, readmeWork, rerunEvent, runEvent } from "./server.ts";

scenario("SCN-INTAKE-052", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server knows that the run "run_5d41402abc4b2a76b971" of the README\'s "work.json" completed with the outcome "cancelled"',
    async () => {
      server = await following(sut, fakes);
      await server.publish(runEvent(server.id, "cancelled"));
      await server.until("cancelled");
    },
  );

  await when(
    'the foreman publishes "run.completed@v1" for the work item with the run "run_0f3c7e91a2b44d6e8c05", the "retryOf" "run_5d41402abc4b2a76b971" and the outcome "succeeded"',
    async () => {
      await server.publish(rerunEvent(runEvent(server.id, "succeeded")));
      await server.until("complete");
    },
  );

  await when('then its "run.started@v1"', async () => {
    const other = (await server.submit({ ...readmeWork(fakes), dedupeKey: "idea:import-csv" })).data?.workItem.id;
    await server.publish(rerunEvent(runEvent(server.id)));
    await server.publish({ ...runEvent(other as string), id: "next.started" });
    await expect
      .poll(async () => (await server.workItem(other as string))?.status, { timeout: 10_000, interval: 50 })
      .toBe("running");
  });

  await then('"/v1/work-items/<id>" shows the status "complete" and the run "run_0f3c7e91a2b44d6e8c05"', async () => {
    expect(await server.workItem(server.id)).toMatchObject({ status: "complete", runId: RUN_AGAIN });
  });
});
