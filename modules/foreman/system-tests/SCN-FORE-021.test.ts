import { scenario } from "@opensoftware/testkit";
import { PLAN, waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-021", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  await given(
    'a run of the README\'s factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"',
    async () => {
      run = await waitingAtGate(sut, fakes);
    },
  );

  await given("the foreman stops and starts again", async () => {
    await run.restart();
  });

  await when('gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate', async () => {
    await run.decide("approved");
  });

  await then(
    '"/v1/runs/<id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"',
    async () => {
      const view = await run.until(run.runId, "complete");
      expect(view.stages.map(({ state }) => state)).toEqual(["succeeded", "succeeded"]);
    },
  );

  await then('the harness received the prompt "Write a plan" only once', async () => {
    expect(run.prompts(PLAN)).toHaveLength(1);
  });
});
