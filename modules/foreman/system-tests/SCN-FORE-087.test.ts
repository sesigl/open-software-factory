import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, started } from "./foreman.ts";

scenario("SCN-FORE-087", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  /** Waits until the agent received the prompt of "implement" this many times, for at most 20 seconds. */
  const implementPrompts = async (count: number) => {
    const deadline = Date.now() + 20_000;
    while (run.prompts(IMPLEMENT).length < count && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return run.prompts(IMPLEMENT).length;
  };

  await given('a run whose stage "implement" runs a turn that waits for "never"', async () => {
    // A second turn for the prompt, for the stage that runs again.
    const waits = { when: IMPLEMENT, waitsFor: "never" };
    run = await started(sut, fakes, { turns: [{ when: PLAN }, waits, waits] });
    await run.untilStage(run.runId, 1, "running");
    expect(await implementPrompts(1)).toBe(1);
  });

  await when("the foreman stops and starts again", async () => {
    await run.restart();
  });

  await then('within 20 seconds the harness received the prompt "Implement plan.md" a second time', async () => {
    expect(await implementPrompts(2)).toBe(2);
  });

  await then('"/v1/runs/<id>" shows the stage "implement" "running"', async () => {
    expect((await run.view(run.runId)).stages[1]?.state).toBe("running");
  });
});
