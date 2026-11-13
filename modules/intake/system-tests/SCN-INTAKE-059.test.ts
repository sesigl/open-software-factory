import { scenario } from "@opensoftware/testkit";
import { issueFollowing, RUN, runEvent } from "./server.ts";

scenario("SCN-INTAKE-059", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof issueFollowing>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server and the GitHub forge adapter with "INTAKE_FORGE_TOKEN", made a work item of the issue "Export reports as CSV" labeled "factory"',
    async () => {
      server = await issueFollowing(sut, fakes);
    },
  );

  await when('the foreman publishes "run.completed@v1" for the work item with the outcome "cancelled"', async () => {
    await server.publish(runEvent(server.id, "cancelled"));
  });

  await then(
    'the issue has the one comment "The run ended with the outcome cancelled: run_5d41402abc4b2a76b971"',
    async () => {
      await expect.poll(() => server.comments(), { timeout: 10_000, interval: 50 }).toHaveLength(1);
      expect(await server.comments()).toEqual([`The run ended with the outcome cancelled: ${RUN}`]);
    },
  );
});
