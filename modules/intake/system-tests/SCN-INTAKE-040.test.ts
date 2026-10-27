import { scenario } from "@opensoftware/testkit";
import { runEvent, slackFollowing } from "./server.ts";

const PULL_REQUEST = "https://github.com/acme/web/pull/8";

scenario("SCN-INTAKE-040", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackFollowing>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server and the Slack channel adapter, made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"',
    async () => {
      server = await slackFollowing(sut, fakes);
    },
  );

  await when(
    'the foreman publishes "run.started@v1" for the work item, then "run.completed@v1" with the outcome "succeeded" and the pull request "https://github.com/acme/web/pull/8"',
    async () => {
      await server.publish(runEvent(server.id));
      await expect.poll(async () => (await server.workItem(server.id))?.status, { timeout: 10_000 }).toBe("running");
      await server.publish(runEvent(server.id, "succeeded", [PULL_REQUEST]));
    },
  );

  await then(
    'the thread has the replies "Received as work item <id>." and "Pull request: https://github.com/acme/web/pull/8"',
    async () => {
      // A reply to the start would come before the one to the pull request.
      await expect.poll(() => server.replies().length, { timeout: 10_000, interval: 50 }).toBeGreaterThanOrEqual(2);
      expect(server.replies().map(({ threadTs, text }) => ({ threadTs, text }))).toEqual([
        { threadTs: server.ts, text: `Received as work item ${server.id}.` },
        { threadTs: server.ts, text: `Pull request: ${PULL_REQUEST}` },
      ]);
    },
  );
});
