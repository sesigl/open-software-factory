import { scenario } from "@opensoftware/testkit";
import { CONSOLE_URL, RUN, runEvent, slackFollowing } from "./server.ts";

scenario("SCN-INTAKE-057", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackFollowing>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, "INTAKE_CONSOLE_URL" set to "https://console.example" and the Slack channel adapter, made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"',
    async () => {
      server = await slackFollowing(sut, fakes, { INTAKE_CONSOLE_URL: CONSOLE_URL });
    },
  );

  await when(
    'the foreman publishes "run.completed@v1" for the work item with the outcome "failed" at the stage "implement"',
    async () => {
      const event = runEvent(server.id, "failed");
      await server.publish({ ...event, data: { ...event.data, stage: "implement" } } as unknown as typeof event);
    },
  );

  await then(
    'the thread has the replies "Received as work item <id>." and "The run ended with the outcome failed at the stage implement: https://console.example/runs/run_5d41402abc4b2a76b971"',
    async () => {
      await expect.poll(() => server.replies().length, { timeout: 10_000, interval: 50 }).toBe(2);
      expect(server.replies().map(({ threadTs, text }) => ({ threadTs, text }))).toEqual([
        { threadTs: server.ts, text: `Received as work item ${server.id}.` },
        {
          threadTs: server.ts,
          text: `The run ended with the outcome failed at the stage implement: ${CONSOLE_URL}/runs/${RUN}`,
        },
      ]);
    },
  );
});
