import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-018", async ({ sut, fakes, given, when, then }) => {
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

  await then('"/v1/runs/<id>" shows the state "cancelled" with the stage "implement" "cancelled"', async () => {
    const view = await run.until(run.runId, "cancelled");
    expect(view.stages[1]).toMatchObject({ stage: "implement", state: "cancelled" });
  });

  await then('the harness never received the prompt "Implement plan.md"', async () => {
    expect(run.prompts(IMPLEMENT)).toEqual([]);
  });
});
