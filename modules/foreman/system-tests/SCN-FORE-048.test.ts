import { scenario } from "@opensoftware/testkit";
import { waitingForCheck } from "./foreman.ts";

scenario("SCN-FORE-048", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingForCheck>>;
  await given(
    'a run of the README\'s "checks/factory.yaml" that is "blocked" with the stage "ship" "blocked" because the check "verify" of its pull request is "pending"',
    async () => {
      run = await waitingForCheck(sut, fakes);
      expect((await run.view(run.runId)).state).toBe("blocked");
    },
  );

  await when('a program posts the signal "cancel" to "/v1/runs/<id>/signals"', async () => {
    expect((await run.signal(run.runId, { type: "cancel" })).response.status).toBe(202);
  });

  await then('"/v1/runs/<id>" shows the state "cancelled" with the stage "ship" "cancelled"', async () => {
    const view = await run.until(run.runId, "cancelled");
    expect(view.stages[2]).toMatchObject({ stage: "ship", state: "cancelled" });
  });
});
