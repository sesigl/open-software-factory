import { scenario } from "@opensoftware/testkit";
import { following, RUN_AGAIN, readmeWork, rerunEvent, runEvent } from "./server.ts";

scenario("SCN-INTAKE-051", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server knows that the work item of the README\'s "work.json" runs again in the run "run_0f3c7e91a2b44d6e8c05" after the run "run_5d41402abc4b2a76b971"',
    async () => {
      server = await following(sut, fakes);
      await server.publish(runEvent(server.id, "failed"));
      await server.until("failed");
      await server.publish(rerunEvent(runEvent(server.id)));
      await server.until("running");
    },
  );

  await when(
    'the foreman\'s "run.completed@v1" of "run_5d41402abc4b2a76b971" with the outcome "failed" arrives again',
    async () => {
      const other = (await server.submit({ ...readmeWork(fakes), dedupeKey: "idea:import-csv" })).data?.workItem.id;
      await server.publish({ ...runEvent(server.id, "failed"), id: "late.completed" });
      // The server handles one subject's events in order: once the next one moved its work item, it handled this one.
      await server.publish({ ...runEvent(other as string, "failed"), id: "next.completed" });
      await expect
        .poll(async () => (await server.workItem(other as string))?.status, { timeout: 10_000, interval: 50 })
        .toBe("failed");
    },
  );

  await then(
    '"/v1/work-items/<id>" still shows the status "running" and the run "run_0f3c7e91a2b44d6e8c05"',
    async () => {
      expect(await server.workItem(server.id)).toMatchObject({ status: "running", runId: RUN_AGAIN });
    },
  );
});
