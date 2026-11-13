import type { RunView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { waitingForCheck } from "./foreman.ts";

scenario("SCN-FORE-114", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingForCheck>>;
  await given(
    'a run of the README\'s "checks/factory.yaml" that is "blocked" with the stage "ship" "blocked" because the check "verify" of its pull request is "pending"',
    async () => {
      run = await waitingForCheck(sut, fakes);
    },
  );

  let view: RunView;
  await when('a program gets "/v1/runs/<id>" with the API token', async () => {
    view = await run.view(run.runId);
  });

  await then('the stage "ship" shows "waitingSince" "2026-01-01T00:00:00.000Z"', async () => {
    expect(view.stages[2]).toMatchObject({ stage: "ship", state: "blocked", waitingSince: "2026-01-01T00:00:00.000Z" });
  });

  await then('the stages that do not wait show no "waitingSince"', async () => {
    expect(view.stages.slice(0, 2).map((stage) => stage.waitingSince)).toEqual([undefined, undefined]);
  });
});
