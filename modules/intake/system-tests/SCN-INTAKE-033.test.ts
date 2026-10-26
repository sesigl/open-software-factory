import { scenario } from "@opensoftware/testkit";
import { following, readmeWork, runEvent } from "./server.ts";

scenario("SCN-INTAKE-033", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server knows that the run of the README\'s "work.json" completed with the outcome "succeeded"',
    async () => {
      server = await following(sut, fakes);
      await server.publish(runEvent(server.id, "succeeded"));
      await server.until("complete");
    },
  );

  await when('the foreman\'s "run.started@v1" for that run arrives after it', async () => {
    const other = (await server.submit({ ...readmeWork(fakes), dedupeKey: "idea:import-csv" })).data?.workItem.id;
    await server.publish(runEvent(server.id));
    // The server handles one subject's events in order: once the next one moved its work item, it handled this one.
    await server.publish({ ...runEvent(other as string), id: "next.started" });
    await expect
      .poll(async () => (await server.workItem(other as string))?.status, { timeout: 10_000, interval: 50 })
      .toBe("running");
  });

  await then('"/v1/work-items/<id>" still shows the status "complete"', async () => {
    expect((await server.workItem(server.id))?.status).toBe("complete");
  });
});
