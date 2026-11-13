import { scenario } from "@opensoftware/testkit";
import { gatewayFactory, IMPLEMENT, PLAN, started } from "./foreman.ts";

scenario("SCN-FORE-121", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  /** Waits until the agent received the prompt of "implement" this many times, for at most 20 seconds. */
  const implementPrompts = async (count: number) => {
    const deadline = Date.now() + 20_000;
    while (run.prompts(IMPLEMENT).length < count && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return run.prompts(IMPLEMENT).length;
  };

  await given(
    'a run of the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm", whose stage "implement" runs a turn that waits for "never"',
    async () => {
      // A second turn for the prompt, for the stage that runs again.
      const waits = { when: IMPLEMENT, waitsFor: "never" };
      run = await started(sut, fakes, {
        factory: gatewayFactory(fakes),
        inference: {},
        turns: [{ when: PLAN }, waits, waits],
      });
      await run.untilStage(run.runId, 1, "running");
      expect(await implementPrompts(1)).toBe(1);
    },
  );

  await when("the foreman stops and starts again", async () => {
    await run.restart();
  });

  await then('within 20 seconds the harness received the prompt "Implement plan.md" a second time', async () => {
    expect(await implementPrompts(2)).toBe(2);
  });

  await then('every turn of the run got the key "sk-fake-1" as "OPENAI_API_KEY"', async () => {
    expect(run.harness.sessions().map(({ env }) => env.OPENAI_API_KEY)).toEqual([
      "sk-fake-1",
      "sk-fake-1",
      "sk-fake-1",
    ]);
  });

  await then(
    'the inference adapter started one gateway and made one key, for the run with the budget "5"',
    async () => {
      expect(run.inference?.started().map(({ id }) => id)).toEqual(["000000000001"]);
      expect(run.inference?.keys()).toEqual([
        { key: "sk-fake-1", gateway: "000000000001", run: run.runId, budget: "5" },
      ]);
    },
  );
});
