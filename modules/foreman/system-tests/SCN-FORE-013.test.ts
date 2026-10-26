import { scenario } from "@opensoftware/testkit";
import { waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-013", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  await given(
    'a run of the README\'s factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"',
    async () => {
      run = await waitingAtGate(sut, fakes);
    },
  );

  await when('gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate', async () => {
    await run.decide("approved");
  });

  await then(
    '"/v1/runs/<id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"',
    async () => {
      const view = await run.until(run.runId, "complete");
      expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
        { stage: "plan", state: "succeeded" },
        { stage: "implement", state: "succeeded" },
      ]);
    },
  );
});
