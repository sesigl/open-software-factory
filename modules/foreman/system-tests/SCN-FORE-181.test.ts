import { scenario } from "@opensoftware/testkit";
import { PLAN, sandboxedFactory, started } from "./foreman.ts";

scenario("SCN-FORE-181", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'a run of the README\'s "sandboxed/factory.yaml" whose "plan" stage creates its sandbox with a fake sandbox adapter whose create takes 1 second',
    async () => {
      run = await started(sut, fakes, { factory: sandboxedFactory(fakes), sandbox: { takesMs: { create: 1000 } } });
    },
  );

  await when(
    'a program posts the signal "cancel" to "/v1/runs/<id>/signals" while the sandbox is created',
    async () => {
      // The fake logs the sandbox when its create begins, and answers 1 second later.
      const deadline = Date.now() + 20_000;
      while (run.sandbox?.created().length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
      expect(run.sandbox?.created()).toHaveLength(1);
      expect((await run.signal(run.runId, { type: "cancel" })).response.status).toBe(202);
    },
  );

  await then('"/v1/runs/<id>" shows the state "cancelled" with the stage "plan" "cancelled"', async () => {
    const view = await run.until(run.runId, "cancelled");
    expect(view.stages.map(({ state }) => state)).toEqual(["cancelled", "pending"]);
  });

  await then('the harness never received the prompt "Write a plan"', async () => {
    expect(run.prompts(PLAN)).toEqual([]);
  });

  await then("the sandbox adapter's sandbox list is empty", async () => {
    expect(run.sandbox?.list()).toEqual([]);
  });
});
