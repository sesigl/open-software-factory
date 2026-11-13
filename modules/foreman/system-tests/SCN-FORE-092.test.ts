import { scenario } from "@opensoftware/testkit";
import { ADA, failed, IMPLEMENT, newRunOf, PLAN, RUN_BEFORE } from "./foreman.ts";

scenario("SCN-FORE-092", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failed>>;
  await given('the server ran the README\'s "work.json" and the "implement" turn ended with "refusal"', async () => {
    run = await failed(sut, fakes, {
      turns: [
        // The new run's "plan" prompt has the line "Run before:"; its reply links a pull request, so only the new
        // run's "implement" prompt has the line "Pull request:".
        { when: RUN_BEFORE, reply: "Opened https://github.com/tester/web/pull/7" },
        { when: PLAN, reply: "plan.md is written" },
        { when: "Pull request:", reply: "done" },
        { when: IMPLEMENT, stopReason: "refusal" },
      ],
    });
  });

  let newId = "";
  await when('"github:ada" posts a retry of the run from the stage "plan"', async () => {
    newId = newRunOf(await run.retry(run.runId, { by: ADA, from: "plan" }));
  });

  await then('"/v1/runs/<new id>" shows the state "complete"', async () => {
    const view = await run.until(newId, "complete");
    expect(view.stages.map(({ state }) => state)).toEqual(["succeeded", "succeeded"]);
  });

  await then('the harness received the prompt "Write a plan" twice', async () => {
    expect(run.prompts(PLAN)).toHaveLength(2);
  });
});
