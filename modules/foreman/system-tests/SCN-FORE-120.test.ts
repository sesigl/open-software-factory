import { scenario } from "@opensoftware/testkit";
import { GATE, IMPLEMENT, PLAN, readmeFiles, waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-120", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  await given(
    'a run of the README\'s factory with the stage "approve" after "implement" that has "wait: true" and a gate, which waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "approve"',
    async () => {
      const factory = `${readmeFiles(fakes)["factory.yaml"]}  - stage: approve\n    wait: true\n    gate:\n      policy: ./policies/approve.rego\n      approvers: [maintainers]\n`;
      run = await waitingAtGate(sut, fakes, { factory });
      const view = await run.view(run.runId);
      expect(view?.stages[2]).toMatchObject({ stage: "approve", state: "blocked", gateId: GATE });
      expect(run.prompts("")).toHaveLength(2);
    },
  );

  await when('gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate', async () => {
    await run.decide("approved");
  });

  await then(
    '"/v1/runs/<id>" shows the state "complete" with the stage "approve" "succeeded", its gate "g0a1b2c3d4e5f6a7b", no agent and no session',
    async () => {
      const view = await run.until(run.runId, "complete");
      const approve = view.stages[2];
      expect(approve).toMatchObject({ stage: "approve", state: "succeeded", gateId: GATE });
      expect(approve && "agent" in approve).toBe(false);
      expect(approve?.sessionId).toBeUndefined();
    },
  );

  await then('the harness received the prompts of the stages "plan" and "implement" and no other', async () => {
    const prompts = run.prompts("");
    expect(prompts).toHaveLength(2);
    expect([PLAN, IMPLEMENT].map((text) => prompts.filter((prompt) => prompt.includes(text)).length)).toEqual([1, 1]);
  });
});
