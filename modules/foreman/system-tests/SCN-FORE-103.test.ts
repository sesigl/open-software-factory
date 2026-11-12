import { scenario } from "@opensoftware/testkit";
import { GATE, IMPLEMENT, newRunOf, waitingAtGate } from "./foreman.ts";

const SECOND = "g9f8e7d6c5b4a3f2e";

scenario("SCN-FORE-103", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  let newId = "";
  await given(
    'a run of the README\'s factory whose gate before the stage "implement" was rejected, and its retry waits at the gate "g9f8e7d6c5b4a3f2e"',
    async () => {
      run = await waitingAtGate(sut, fakes, { gates: [GATE, SECOND] });
      await run.decide("rejected");
      await run.until(run.runId, "failed");
      newId = newRunOf(await run.retry(run.runId));
      const view = await run.until(newId, "blocked");
      expect(view.stages[1]?.gateId).toBe(SECOND);
    },
  );

  await when(
    'gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate "g9f8e7d6c5b4a3f2e" of the work item',
    async () => {
      await run.decide("approved", SECOND);
    },
  );

  await then(
    '"/v1/runs/<new id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"',
    async () => {
      const view = await run.until(newId, "complete");
      expect(view.stages.map(({ state }) => state)).toEqual(["succeeded", "succeeded"]);
      expect(run.prompts(IMPLEMENT)).toEqual([
        expect.stringContaining(`\n\nRun before: ${run.runId}: the gate before the stage implement was rejected\n`),
      ]);
    },
  );
});
