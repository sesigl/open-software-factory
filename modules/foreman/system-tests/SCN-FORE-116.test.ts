import type { RunView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { GATE, IMPLEMENT, WAIT_MS, waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-116", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  let failed: RunView;
  await given(
    'a run of the README\'s factory with "FOREMAN_GATE_TIMEOUT_MS" "1000" that failed because the gate "g0a1b2c3d4e5f6a7b" expired',
    async () => {
      run = await waitingAtGate(sut, fakes, { env: { FOREMAN_GATE_TIMEOUT_MS: "1000" } });
      failed = await run.until(run.runId, "failed");
      expect(failed.stages[1]?.reason).toBe("the gate g0a1b2c3d4e5f6a7b expired: no decision after 1000 ms");
    },
  );

  await when('gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate', async () => {
    await run.decide("approved");
  });

  await then(
    'the server warns "osf.gate.decided.v1: <id> is failed: the decision of the gate g0a1b2c3d4e5f6a7b came too late"',
    async () => {
      const deadline = Date.now() + WAIT_MS;
      const warned = () =>
        sut.http
          .output()
          .stderr.split("\n")
          .filter((line) => line.startsWith("foreman: osf.gate.decided.v1: "));
      while (warned().length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
      expect(warned()).toEqual([
        `foreman: osf.gate.decided.v1: ${run.runId} is failed: the decision of the gate ${GATE} came too late`,
      ]);
    },
  );

  await then(
    '"/v1/runs/<id>" still shows the state "failed" with the stage "implement" "rejected" and the same reason',
    async () => {
      expect(await run.view(run.runId)).toEqual(failed);
    },
  );

  await then('the harness never received the prompt "Implement plan.md"', async () => {
    expect(run.prompts(IMPLEMENT)).toEqual([]);
  });
});
