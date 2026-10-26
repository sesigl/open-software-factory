import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-004", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with a scripted harness that ends the "plan" turn with "refusal"',
    async () => {
      server = await serving(sut, fakes, { turns: [{ when: PLAN, stopReason: "refusal" }] });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" shows the state "failed" with the stage "plan" "failed" and the stage "implement" "pending"',
    async () => {
      const view = await server.until(runId, "failed");
      expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
        { stage: "plan", state: "failed" },
        { stage: "implement", state: "pending" },
      ]);
      expect(view.stages[0]?.sessionId).toBeTruthy();
      expect(view.endedAt).toBe("2026-01-01T00:00:00.000Z");
    },
  );

  await then('the harness never received the prompt "Implement plan.md"', async () => {
    expect(server.prompts(IMPLEMENT)).toEqual([]);
  });
});
