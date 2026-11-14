import { scenario } from "@opensoftware/testkit";
import { following } from "./server.ts";

const REMOVED = "intake removed 1 published events from the outbox";

scenario("SCN-INTAKE-065", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  let first = "";
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, "INTAKE_OUTBOX_KEEP" set to "7d" and "OSF_NOW" set to "2026-01-01T00:00:00Z", received the README\'s "work.json"',
    async () => {
      server = await following(sut, fakes, { INTAKE_OUTBOX_KEEP: "7d", OSF_NOW: "2026-01-01T00:00:00Z" });
    },
  );

  await given("the server stops", async () => {
    await server.stop();
    first = sut.http.output().stdout;
  });

  await when('the server starts again with "OSF_NOW" set to "2026-01-08T00:00:01Z"', async () => {
    await server.start({ OSF_NOW: "2026-01-08T00:00:01Z" });
  });

  await then(
    'it prints "intake removed 1 published events from the outbox", which its first start did not print',
    async () => {
      expect(first).toContain("intake serves the work item API");
      expect(first).not.toContain(REMOVED);
      await expect.poll(() => sut.http.output().stdout.split(REMOVED).length - 1, { timeout: 5_000 }).toBe(1);
    },
  );
});
