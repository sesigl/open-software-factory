import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, started } from "./foreman.ts";

scenario("SCN-FORE-058", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('a run whose stage "implement" runs a turn that waits for "never"', async () => {
    run = await started(sut, fakes, {
      turns: [
        { when: PLAN, edits: { "plan.md": "the plan\n" } },
        { when: IMPLEMENT, waitsFor: "never" },
      ],
      env: { OSF_DATA: sut.files.path("$OUTPUT/foreman") },
    });
    await run.untilStage(run.runId, 1, "running");
  });

  let answer: Awaited<ReturnType<typeof run.signal>>;
  await when('a person posts the signal "take-over"', async () => {
    answer = await run.signal(run.runId, { type: "take-over" });
  });

  await then("the answer has the status 202", async () => {
    expect(answer.response.status).toBe(202);
  });

  let view: Awaited<ReturnType<typeof run.view>>;
  await then(
    '"/v1/runs/<id>" shows the state "blocked" with the stage "implement" "blocked" and a time "takenOverAt"',
    async () => {
      view = await run.untilStage(run.runId, 1, "blocked");
      expect(view.state).toBe("blocked");
      expect(view.stages[0]?.state).toBe("succeeded");
      expect(view.stages[1]?.takenOverAt).toMatch(/^\d{4}-\d\d-\d\dT/);
      expect(view.stages[1]?.endedAt).toBeUndefined();
    },
  );

  await then(
    'it shows the run\'s folder "$OUTPUT/foreman/runs/<id>" with the file "plan.md" the stage "plan" wrote',
    async () => {
      expect(view.folder).toBe(sut.files.path(`$OUTPUT/foreman/runs/${run.runId}`));
      expect(await sut.files.read(`$OUTPUT/foreman/runs/${run.runId}/plan.md`)).toBe("the plan\n");
    },
  );
});
