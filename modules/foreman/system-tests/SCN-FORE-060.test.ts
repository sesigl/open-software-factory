import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, sandboxedFactory, started } from "./foreman.ts";

scenario("SCN-FORE-060", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'a run of the README\'s "sandboxed/factory.yaml" whose stage "implement" runs a turn that waits for "never"',
    async () => {
      run = await started(sut, fakes, {
        factory: sandboxedFactory(fakes),
        sandbox: {},
        turns: [
          { when: PLAN, edits: { "plan.md": "the plan\n" } },
          { when: IMPLEMENT, waitsFor: "never" },
        ],
        env: { OSF_DATA: sut.files.path("$OUTPUT/foreman") },
      });
      await run.untilStage(run.runId, 1, "running");
    },
  );

  await when('a person posts the signal "take-over" and the stage "implement" is "blocked"', async () => {
    await run.signal(run.runId, { type: "take-over" });
    await run.untilStage(run.runId, 1, "blocked");
  });

  await then("the sandbox adapter's list is empty", async () => {
    expect(run.sandbox?.created().map(({ id }) => id)).toEqual(["000000000001", "000000000002"]);
    expect(run.sandbox?.list()).toEqual([]);
  });

  await then('the run\'s folder holds the file "plan.md" that the stage "plan" wrote', async () => {
    expect(await sut.files.read(`$OUTPUT/foreman/runs/${run.runId}/plan.md`)).toBe("the plan\n");
  });
});
