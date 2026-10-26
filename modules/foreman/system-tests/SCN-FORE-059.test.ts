import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, sandboxedFactory, started } from "./foreman.ts";

scenario("SCN-FORE-059", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'a person took over the stage "plan" of a run of the README\'s "sandboxed/factory.yaml" with a fake sandbox adapter',
    async () => {
      run = await started(sut, fakes, {
        factory: sandboxedFactory(fakes),
        sandbox: {},
        turns: [{ when: PLAN, waitsFor: "never" }, { when: IMPLEMENT }],
        env: { OSF_DATA: sut.files.path("$OUTPUT/foreman") },
      });
      await run.untilStage(run.runId, 0, "running");
      await run.signal(run.runId, { type: "take-over" });
      await run.untilStage(run.runId, 0, "blocked");
    },
  );

  await given('the person wrote "plan.md" in the run\'s folder', async () => {
    expect((await run.view(run.runId)).folder).toBe(sut.files.path(`$OUTPUT/foreman/runs/${run.runId}`));
    await sut.files.put(`$OUTPUT/foreman/runs/${run.runId}/plan.md`, "the person's plan\n");
  });

  let answer: Awaited<ReturnType<typeof run.signal>>;
  await when('the person posts the signal "hand-back"', async () => {
    answer = await run.signal(run.runId, { type: "hand-back" });
    expect(answer.response.status).toBe(202);
  });

  await then(
    'the stage "plan" is "succeeded" and the stage "implement" ran in a sandbox that held "plan.md"',
    async () => {
      const view = await run.untilStage(run.runId, 1, "succeeded");
      expect(view.stages[0]).toMatchObject({ stage: "plan", state: "succeeded" });
      const harness = (run.sandbox?.execs() ?? []).filter(({ command }) =>
        command.join(" ").includes(sut.adapter("harness/acp")),
      );
      expect(harness.map(({ id }) => id)).toEqual(["000000000001", "000000000002"]);
      expect(harness[1]?.files).toContain(`${run.runId}/plan.md`);
    },
  );

  await then('"/v1/runs/<id>" shows the state "complete"', async () => {
    expect((await run.until(run.runId, "complete")).state).toBe("complete");
  });
});
