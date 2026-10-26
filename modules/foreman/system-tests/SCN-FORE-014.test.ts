import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-014", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  await given(
    'a run of the README\'s factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"',
    async () => {
      run = await waitingAtGate(sut, fakes);
    },
  );

  await when('gatekeeper publishes "gate.decided@v1" with the decision "rejected" for the gate', async () => {
    await run.decide("rejected");
  });

  await then('"/v1/runs/<id>" shows the state "failed" with the stage "implement" "rejected"', async () => {
    const view = await run.until(run.runId, "failed");
    expect(view.stages[1]).toMatchObject({ stage: "implement", state: "rejected" });
  });

  await then('the harness never received the prompt "Implement plan.md"', async () => {
    expect(run.prompts(IMPLEMENT)).toEqual([]);
  });
});
