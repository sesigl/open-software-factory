import { scenario } from "@opensoftware/testkit";
import { following, readmeWork, runEvent } from "./server.ts";

scenario("SCN-INTAKE-038", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, received the README\'s "work.json"',
    async () => {
      server = await following(sut, fakes);
    },
  );

  await when('the foreman publishes "run.completed@v1" for the work item with the outcome "merged"', async () => {
    const other = (await server.submit({ ...readmeWork(fakes), dedupeKey: "idea:import-csv" })).data?.workItem.id;
    await server.publish(runEvent(server.id, "merged" as never));
    // The server handles one subject's events in order: once the next one moved its work item, it handled this one.
    await server.publish({ ...runEvent(other as string, "failed"), id: "next.completed" });
    await expect
      .poll(async () => (await server.workItem(other as string))?.status, { timeout: 10_000, interval: 50 })
      .toBe("failed");
  });

  await then('"/v1/work-items/<id>" still shows the status "received"', async () => {
    expect(await server.workItem(server.id)).toMatchObject({ status: "received" });
    expect((await server.workItem(server.id))?.runId).toBeUndefined();
  });
});
