import { scenario } from "@opensoftware/testkit";
import { PLAN, started } from "./foreman.ts";

const FIRST = "use the existing date helper";
const SECOND = "and add a test";

scenario("SCN-FORE-031", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('a run whose stage "implement" runs a turn that waits for "and add a test"', async () => {
    run = await started(sut, fakes, {
      turns: [{ when: PLAN }, { when: "Implement plan.md", waitsFor: SECOND }, { when: FIRST }],
    });
    await run.untilStage(run.runId, 1, "running");
  });

  await when('a person posts the signal "steer" with the message "use the existing date helper"', async () => {
    await run.signal(run.runId, { type: "steer", message: FIRST });
  });

  await when('after the agent received it, the signal "steer" with the message "and add a test"', async () => {
    while (run.prompts(FIRST).length === 0) await new Promise((resolve) => setTimeout(resolve, 20));
    await run.signal(run.runId, { type: "steer", message: SECOND });
  });

  await then('the agent received "use the existing date helper" and then "and add a test", each once', async () => {
    await run.until(run.runId, "complete");
    expect(run.harness.prompts().slice(2)).toEqual([FIRST, SECOND]);
  });
});
