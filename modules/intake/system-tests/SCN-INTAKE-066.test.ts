import { scenario } from "@opensoftware/testkit";
import { blockedEvent, CONSOLE_URL, RUN, runEvent, slackFollowing } from "./server.ts";

const PULL_REQUEST = "https://github.com/acme/web/pull/7";

scenario("SCN-INTAKE-066", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackFollowing>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, "INTAKE_CONSOLE_URL" set to "https://console.example" and the Slack channel adapter, made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"',
    async () => {
      server = await slackFollowing(sut, fakes, { INTAKE_CONSOLE_URL: CONSOLE_URL });
    },
  );

  await when(
    'the foreman publishes "run.blocked@v1" for the work item at the stage "ship" for the checks of "https://github.com/acme/web/pull/7" twice, then "run.completed@v1" with the outcome "failed" at the stage "ship" and the reason "the check verify ended with failure"',
    async () => {
      await server.publish(blockedEvent(server.id, "ship", PULL_REQUEST));
      await server.publish(blockedEvent(server.id, "ship", PULL_REQUEST));
      const event = runEvent(server.id, "failed");
      const data = { ...event.data, stage: "ship", reason: "the check verify ended with failure" };
      await server.publish({ ...event, data } as unknown as typeof event);
    },
  );

  await then(
    'the thread has the replies "Received as work item <id>.", "The run waits for the checks of https://github.com/acme/web/pull/7 at the stage ship: https://console.example/runs/run_5d41402abc4b2a76b971" and "The run ended with the outcome failed at the stage ship (the check verify ended with failure): https://console.example/runs/run_5d41402abc4b2a76b971"',
    async () => {
      await expect.poll(() => server.replies().length, { timeout: 10_000, interval: 50 }).toBe(3);
      expect(server.replies().map(({ threadTs, text }) => ({ threadTs, text }))).toEqual([
        { threadTs: server.ts, text: `Received as work item ${server.id}.` },
        {
          threadTs: server.ts,
          text: `The run waits for the checks of ${PULL_REQUEST} at the stage ship: ${CONSOLE_URL}/runs/${RUN}`,
        },
        {
          threadTs: server.ts,
          text: `The run ended with the outcome failed at the stage ship (the check verify ended with failure): ${CONSOLE_URL}/runs/${RUN}`,
        },
      ]);
    },
  );
});
