import { scenario } from "@opensoftware/testkit";
import { waitingForCheck } from "./foreman.ts";

scenario("SCN-FORE-044", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingForCheck>>;
  await given(
    'a run of the README\'s "checks/factory.yaml" that is "blocked" with the stage "ship" "blocked" because the check "verify" of its pull request is "pending"',
    async () => {
      run = await waitingForCheck(sut, fakes);
      const view = await run.view(run.runId);
      expect(view.state).toBe("blocked");
      expect(view.stages[2]?.checks).toEqual([{ name: "verify", state: "pending" }]);
    },
  );

  await when('the fake GitHub sets the check "verify" of the pull request to "success"', async () => {
    await run.check("success");
  });

  await then('"/v1/runs/<id>" shows the state "complete" with the stage "ship" "succeeded"', async () => {
    const view = await run.until(run.runId, "complete");
    expect(view.stages[2]).toMatchObject({ stage: "ship", state: "succeeded" });
  });
});
