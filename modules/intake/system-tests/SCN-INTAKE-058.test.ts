import { scenario } from "@opensoftware/testkit";
import { CONSOLE_URL, gateEvent, RUN, runEvent, slackFollowing } from "./server.ts";

scenario("SCN-INTAKE-058", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackFollowing>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, "INTAKE_CONSOLE_URL" set to "https://console.example" and the Slack channel adapter, made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"',
    async () => {
      server = await slackFollowing(sut, fakes, { INTAKE_CONSOLE_URL: CONSOLE_URL });
    },
  );

  // The gatekeeper's event does not carry the run; the work item knows it.
  await given(
    'the foreman published "run.started@v1" for the work item with the run "run_5d41402abc4b2a76b971"',
    async () => {
      await server.publish(runEvent(server.id));
    },
  );

  await when(
    'the gatekeeper publishes "gate.requested@v1" for the work item at the stage "deploy" with the summary "Deploy to production?" twice, then the foreman publishes "run.completed@v1" with the outcome "failed"',
    async () => {
      await server.publish(gateEvent(server.id, "deploy", "Deploy to production?"));
      await server.publish(gateEvent(server.id, "deploy", "Deploy to production?"));
      await server.publish(runEvent(server.id, "failed"));
    },
  );

  await then(
    'the thread has the replies "Received as work item <id>.", "The run waits for a decision at the stage deploy: Deploy to production? https://console.example/runs/run_5d41402abc4b2a76b971" and "The run ended with the outcome failed: https://console.example/runs/run_5d41402abc4b2a76b971"',
    async () => {
      await expect.poll(() => server.replies().length, { timeout: 10_000, interval: 50 }).toBe(3);
      expect(server.replies().map(({ threadTs, text }) => ({ threadTs, text }))).toEqual([
        { threadTs: server.ts, text: `Received as work item ${server.id}.` },
        {
          threadTs: server.ts,
          text: `The run waits for a decision at the stage deploy: Deploy to production? ${CONSOLE_URL}/runs/${RUN}`,
        },
        { threadTs: server.ts, text: `The run ended with the outcome failed: ${CONSOLE_URL}/runs/${RUN}` },
      ]);
    },
  );
});
