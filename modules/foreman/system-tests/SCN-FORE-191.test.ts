import { scenario } from "@opensoftware/testkit";
import { otherWork, PLAN, started, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-191", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_MAX_STAGES" set to "1" and a run of the README\'s "work.json" whose "plan" turn waits',
    async () => {
      run = await started(sut, fakes, {
        turns: [{ when: PLAN, waitsFor: "never" }],
        env: { FOREMAN_MAX_STAGES: "1" },
      });
      // The first run's stage holds the one place once its agent has the prompt.
      const deadline = Date.now() + WAIT_MS;
      while (run.prompts(PLAN).length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
      expect(run.prompts(PLAN)).toHaveLength(1);
    },
  );

  let second = "";
  await when('a program posts a second work item to "/v1/runs" with the API token', async () => {
    const { data, response } = await run.start(otherWork(fakes));
    expect(response.status).toBe(201);
    second = data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" of the second run shows the state "running" and the stage "plan" "blocked" with "waitingSince" and without "startedAt"',
    async () => {
      const view = await run.untilStage(second, 0, "blocked");
      expect(view.state).toBe("running");
      expect(view.stages[0]?.waitingSince).toMatch(/^\d{4}-\d\d-\d\dT/);
      expect(view.stages[0]).not.toHaveProperty("startedAt");
    },
  );

  await then('the harness received the prompt "Write a plan" once', async () => {
    expect(run.prompts(PLAN)).toHaveLength(1);
  });
});
