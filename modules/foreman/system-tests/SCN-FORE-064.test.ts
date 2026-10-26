import { scenario } from "@opensoftware/testkit";
import { endingTurns, otherWork, readmeWork, serving, TITLE, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-064", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  const started: { runId: string; title: string }[] = [];
  await given(
    'the server completed the runs of the README\'s "work.json" and of the work item "Import reports from CSV"',
    async () => {
      server = await serving(sut, fakes, { turns: [...endingTurns, ...endingTurns] });
      for (const work of [readmeWork(fakes), otherWork(fakes)]) {
        const runId = (await server.start(work)).data?.runId as string;
        await server.until(runId, "complete");
        started.push({ runId, title: work.title });
      }
    },
  );

  let runs: { runId: string; state: string; workItem: { title: string } }[] = [];
  await when('a program reads "/v1/runs" with the API token', async () => {
    // Temporal's visibility shows a run a moment after it started.
    await expect.poll(async () => (await server.list()).data?.runs.length, { timeout: WAIT_MS, interval: 100 }).toBe(2);
    runs = (await server.list()).data?.runs ?? [];
  });

  await then('the answer lists both runs in the state "complete", each with its work item\'s title', async () => {
    expect(started.map(({ title }) => title)).toEqual([TITLE, "Import reports from CSV"]);
    // Both runs started at the testkit's fixed time, so their run IDs order them.
    const expected = started
      .map((run) => ({ ...run, state: "complete" }))
      .sort((a, b) => a.runId.localeCompare(b.runId));
    expect(runs.map(({ runId, state, workItem }) => ({ runId, title: workItem.title, state }))).toEqual(expected);
  });
});
