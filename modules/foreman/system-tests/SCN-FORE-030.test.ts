import { scenario } from "@opensoftware/testkit";
import { WAIT_MS, waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-030", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  await given(
    'a run of the README\'s factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"',
    async () => {
      run = await waitingAtGate(sut, fakes);
    },
  );

  await when('a person posts the signal "cancel"', async () => {
    await run.signal(run.runId, { type: "cancel" });
  });

  await then(
    'the server publishes "run.completed@v1" with the outcome "cancelled" and the stage "implement"',
    async () => {
      const [completed] = await run.events.received("run.completed@v1", { timeoutMs: WAIT_MS });
      expect(completed?.data).toMatchObject({ stage: "implement", outcome: "cancelled" });
    },
  );
});
