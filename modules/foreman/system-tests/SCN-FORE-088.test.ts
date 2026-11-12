import { scenario } from "@opensoftware/testkit";
import { failed, IMPLEMENT, newRunOf, PLAN } from "./foreman.ts";

scenario("SCN-FORE-088", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failed>>;
  await given('the server ran the README\'s "work.json" and the "implement" turn ended with "refusal"', async () => {
    run = await failed(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof run.retry>>;
  await when('"github:ada" posts a retry of the run to "/v1/runs/<id>/retry"', async () => {
    answer = await run.retry(run.runId);
  });

  let newId = "";
  await then(
    'the answer has the status 201 and a new run ID with the attempt 2, the run before "<id>" and the person "github:ada"',
    async () => {
      newId = newRunOf(answer);
      expect(newId).toMatch(/^run_[0-9a-f]{20}$/);
      expect(newId).not.toBe(run.runId);
      expect(answer.data).toMatchObject({
        attempt: 2,
        retryOf: run.runId,
        retriedBy: { kind: "person", id: "github:ada" },
        state: "running",
      });
    },
  );

  await then(
    '"/v1/runs/<new id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"',
    async () => {
      const view = await run.until(newId, "complete");
      expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
        { stage: "plan", state: "succeeded" },
        { stage: "implement", state: "succeeded" },
      ]);
    },
  );

  await then(
    'the harness received the prompt "Write a plan" only once and the prompt "Implement plan.md" twice',
    async () => {
      expect(run.prompts(PLAN)).toHaveLength(1);
      expect(run.prompts(IMPLEMENT)).toHaveLength(2);
    },
  );
});
