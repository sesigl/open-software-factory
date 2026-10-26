import { scenario } from "@opensoftware/testkit";
import { WAIT_MS, waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-067", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  await given('a run of the README\'s "work.json" waits at the gate before "implement"', async () => {
    run = await waitingAtGate(sut, fakes);
  });

  let runs: { runId: string; state: string; stages: { stage: string; state: string }[] }[] = [];
  await when('a program reads "/v1/runs?state=blocked" with the API token', async () => {
    // Temporal's visibility shows a run a moment after it started.
    await expect
      .poll(async () => (await run.list("blocked")).data?.runs.length, { timeout: WAIT_MS, interval: 100 })
      .toBe(1);
    runs = (await run.list("blocked")).data?.runs ?? [];
  });

  await then('the answer lists the run in the state "blocked" with the stage "implement" "blocked"', async () => {
    expect(runs.map(({ runId, state, stages }) => ({ runId, state, stages: stages.map((s) => s.state) }))).toEqual([
      { runId: run.runId, state: "blocked", stages: ["succeeded", "blocked"] },
    ]);
  });
});
