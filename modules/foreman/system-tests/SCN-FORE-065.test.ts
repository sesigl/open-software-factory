import { scenario } from "@opensoftware/testkit";
import { otherWork, readmeWork, serving, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-065", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let failed = "";
  await given(
    'the server completed the run of the README\'s "work.json" and failed the run of "Import reports from CSV"',
    async () => {
      server = await serving(sut, fakes, {
        turns: [
          { when: "Import reports from CSV", stopReason: "refusal" },
          { when: "Write a plan", reply: "plan.md is written" },
          { when: "Implement plan.md", reply: "done" },
        ],
      });
      const readme = (await server.start(readmeWork(fakes))).data?.runId as string;
      await server.until(readme, "complete");
      failed = (await server.start(otherWork(fakes))).data?.runId as string;
      await server.until(failed, "failed");
      // Temporal's visibility shows a run a moment after it started.
      await expect
        .poll(async () => (await server.list()).data?.runs.length, { timeout: WAIT_MS, interval: 100 })
        .toBe(2);
    },
  );

  let answer: Awaited<ReturnType<typeof server.list>>;
  await when('a program reads "/v1/runs?state=failed" with the API token', async () => {
    answer = await server.list("failed");
  });

  await then('the answer lists only the run of "Import reports from CSV"', async () => {
    expect(answer.response.status).toBe(200);
    expect(answer.data?.runs.map(({ runId, state, workItem }) => ({ runId, state, title: workItem.title }))).toEqual([
      { runId: failed, state: "failed", title: "Import reports from CSV" },
    ]);
    // The other states are known too, and no run is in them.
    for (const state of ["running", "blocked", "cancelled"])
      expect(await server.list(state).then(({ response, data }) => [response.status, data?.runs])).toEqual([200, []]);
  });
});
