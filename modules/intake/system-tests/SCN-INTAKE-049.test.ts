import { scenario } from "@opensoftware/testkit";
import { following, runEvent } from "./server.ts";

scenario("SCN-INTAKE-049", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, received the README\'s "work.json"',
    async () => {
      server = await following(sut, fakes);
    },
  );

  await when('the foreman publishes "run.completed@v1" for the work item with the outcome "merged"', async () => {
    await server.publish(runEvent(server.id, "merged" as never));
  });

  await then(
    'within 10 seconds the server warns twice about "osf.run.completed.v1", for the delivery 1 and 2 of 5',
    async () => {
      // JetStream sends an unacknowledged message again after 30 seconds; only the server's nak brings it back in 5.
      const warnings = () =>
        sut.http
          .output()
          .stderr.split("\n")
          .filter((line) => line.includes("osf.run.completed.v1"));
      await expect.poll(() => warnings().length, { timeout: 10_000, interval: 100 }).toBe(2);
      expect(warnings()[0]).toMatch(/^intake: osf\.run\.completed\.v1: .+ \(delivery 1 of 5\)$/);
      expect(warnings()[1]).toMatch(/\(delivery 2 of 5\)$/);
    },
  );
});
