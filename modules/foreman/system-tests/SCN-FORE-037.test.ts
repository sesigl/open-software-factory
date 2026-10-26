import { scenario } from "@opensoftware/testkit";
import { PLAN, sandboxedFactory, started } from "./foreman.ts";

scenario("SCN-FORE-037", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'a run of the README\'s "sandboxed/factory.yaml" whose "plan" stage runs in a sandbox of a fake sandbox adapter and waits',
    async () => {
      run = await started(sut, fakes, {
        factory: sandboxedFactory(fakes),
        sandbox: {},
        turns: [{ when: PLAN, waitsFor: "never" }],
      });
      await run.untilStage(run.runId, 0, "running");
      const deadline = Date.now() + 10_000;
      while (run.prompts(PLAN).length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
      expect(run.sandbox?.list()).toEqual(["000000000001"]);
    },
  );

  await when('a program posts the signal "cancel" to "/v1/runs/<id>/signals"', async () => {
    await run.signal(run.runId, { type: "cancel" });
  });

  await then('"/v1/runs/<id>" shows the state "cancelled"', async () => {
    expect((await run.until(run.runId, "cancelled")).state).toBe("cancelled");
  });

  await then("the sandbox adapter's sandbox list is empty", async () => {
    expect(run.sandbox?.list()).toEqual([]);
  });
});
