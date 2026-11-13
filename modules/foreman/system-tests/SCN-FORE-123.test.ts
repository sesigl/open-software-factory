import { scenario } from "@opensoftware/testkit";
import { gatewayFactory, IMPLEMENT, PLAN, started } from "./foreman.ts";
import { revokes } from "./revoked.ts";

scenario("SCN-FORE-123", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'a run of the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm", whose stage "implement" runs a turn that waits for "never"',
    async () => {
      run = await started(sut, fakes, {
        factory: gatewayFactory(fakes),
        inference: {},
        turns: [{ when: PLAN }, { when: IMPLEMENT, waitsFor: "never" }],
      });
      await run.untilStage(run.runId, 1, "running");
    },
  );

  await when("a program cancels the run", async () => {
    expect((await run.signal(run.runId, { type: "cancel" })).response.status).toBe(202);
  });

  await then('"/v1/runs/<id>" shows the state "cancelled"', async () => {
    expect((await run.until(run.runId, "cancelled")).state).toBe("cancelled");
  });

  await then("the inference adapter revoked the key of the run once", async () => {
    expect(await revokes(run.inference)).toEqual([{ gateway: "000000000001", run: run.runId }]);
  });
});
