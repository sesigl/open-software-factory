import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-001", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with a scripted harness that ends every turn',
    async () => {
      server = await serving(sut, fakes);
    },
  );

  let answer: Awaited<ReturnType<typeof server.start>>;
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    answer = await server.start(readmeWork(fakes));
  });

  await then('the answer has the status 201 and a run "run_" in the state "running"', async () => {
    expect(answer.response.status, JSON.stringify(answer.error)).toBe(201);
    expect(answer.data?.runId).toMatch(/^run_[0-9a-f]{20}$/);
    expect(answer.data?.state).toBe("running");
  });

  await then(
    '"/v1/runs/<id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"',
    async () => {
      const view = await server.until(answer.data?.runId as string, "complete");
      expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
        { stage: "plan", state: "succeeded" },
        { stage: "implement", state: "succeeded" },
      ]);
    },
  );
});
