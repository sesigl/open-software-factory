import { scenario } from "@opensoftware/testkit";
import { runEvent, slackFollowing } from "./server.ts";

scenario("SCN-INTAKE-040", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackFollowing>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server and the Slack channel adapter, made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"',
    async () => {
      server = await slackFollowing(sut, fakes);
    },
  );

  await when(
    'the foreman publishes "run.completed@v1" for the work item with the outcome "failed" and no pull request',
    async () => {
      await server.publish(runEvent(server.id, "failed"));
    },
  );

  await then('"/v1/work-items/<id>" shows the status "failed"', async () => {
    await expect.poll(async () => (await server.workItem(server.id))?.status, { timeout: 10_000 }).toBe("failed");
  });

  await then('the thread has one reply, "Received as work item <id>."', async () => {
    expect(server.replies().map(({ threadTs, text }) => ({ threadTs, text }))).toEqual([
      { threadTs: server.ts, text: `Received as work item ${server.id}.` },
    ]);
  });
});
