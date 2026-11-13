import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-115", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  await given(
    'a run of the README\'s factory with "FOREMAN_GATE_TIMEOUT_MS" "1000" waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement", whose policy names no "expire_after"',
    async () => {
      run = await waitingAtGate(sut, fakes, { env: { FOREMAN_GATE_TIMEOUT_MS: "1000" } });
    },
  );

  await when('no "gate.decided@v1" comes for the gate', async () => {
    expect(run.gatekeeper?.received()).toHaveLength(1);
  });

  await then(
    '"/v1/runs/<id>" shows the state "failed" with the stage "implement" "rejected" and the reason "the gate g0a1b2c3d4e5f6a7b expired: no decision after 1000 ms"',
    async () => {
      const view = await run.until(run.runId, "failed");
      expect(view.stages[1]).toMatchObject({
        stage: "implement",
        state: "rejected",
        gateId: "g0a1b2c3d4e5f6a7b",
        reason: "the gate g0a1b2c3d4e5f6a7b expired: no decision after 1000 ms",
      });
    },
  );

  await then('the harness never received the prompt "Implement plan.md"', async () => {
    expect(run.prompts(IMPLEMENT)).toEqual([]);
  });
});
