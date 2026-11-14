import { scenario } from "@opensoftware/testkit";
import { ADA, IMPLEMENT, PLAN, started } from "./foreman.ts";

const STEER = "use the existing date helper";

scenario("SCN-FORE-149", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('a run whose stage "implement" runs a turn that waits for "never"', async () => {
    run = await started(sut, fakes, {
      turns: [{ when: PLAN }, { when: IMPLEMENT, waitsFor: "never" }, { when: STEER, waitsFor: "never" }],
    });
    await run.untilStage(run.runId, 1, "running");
  });

  await when(
    'the person "github:ada" posts the signal "steer" with the message "use the existing date helper" and then the signal "cancel"',
    async () => {
      const steer = await run.signal(run.runId, { type: "steer", message: STEER, by: ADA });
      expect(steer.response.status).toBe(202);
      const cancel = await run.signal(run.runId, { type: "cancel", by: ADA });
      expect(cancel.response.status).toBe(202);
    },
  );

  await then(
    '"/v1/runs/<id>" shows the state "cancelled" and the actions "steer" with the message and "cancel", each by "github:ada" at "2026-01-01T00:00:00.000Z"',
    async () => {
      const view = await run.until(run.runId, "cancelled");
      const at = "2026-01-01T00:00:00.000Z";
      expect(view.actions).toEqual([
        { type: "steer", by: ADA, at, message: STEER },
        { type: "cancel", by: ADA, at },
      ]);
    },
  );
});
