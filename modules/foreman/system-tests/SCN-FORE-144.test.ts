import { scenario } from "@opensoftware/testkit";
import { endingTurns, otherWork, readmeWork, serving, TITLE, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-144", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    'the server completed the runs of the README\'s "work.json" and of the work item "Import reports from CSV"',
    async () => {
      server = await serving(sut, fakes, { turns: [...endingTurns, ...endingTurns], nats: true });
      const events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.run.>");
      // Temporal lists the runs that ended by the time they closed. A run closes after it published
      // run.completed@v1, which follows the view's "complete", so the next run starts only after that event.
      for (const [at, work] of [readmeWork(fakes), otherWork(fakes)].entries()) {
        const runId = (await server.start(work)).data?.runId as string;
        await server.until(runId, "complete");
        await expect
          .poll(async () => (await events.received("run.completed@v1", { timeoutMs: WAIT_MS })).length, {
            timeout: WAIT_MS,
          })
          .toBeGreaterThan(at);
      }
      // Temporal's visibility shows a run a moment after it started, and that it ended a moment after it closed. It lists
      // running runs first, so a run it still lists as running led the first page and, once it ended, the next one too
      // (run 43598754387): both runs completed only once the first page's next page lists the other run.
      await expect
        .poll(
          async () => {
            const first = await server.page({ limit: 1 });
            const cursor = first.data?.next;
            if (!cursor) return [];
            const next = await server.page({ limit: 1, cursor });
            return [...(first.data?.runs ?? []), ...(next.data?.runs ?? [])].map((run) => run.runId);
          },
          { timeout: WAIT_MS, interval: 100 },
        )
        .toSatisfy((ids: string[]) => ids.length === 2 && ids[0] !== ids[1]);
    },
  );

  let first: Awaited<ReturnType<typeof server.page>>;
  let next: Awaited<ReturnType<typeof server.page>>;
  await when(
    'a program reads "/v1/runs?limit=1" and then the page of its "next" cursor with the API token',
    async () => {
      first = await server.page({ limit: 1 });
      next = await server.page({ limit: 1, cursor: first.data?.next as string });
    },
  );

  const titles = (page: typeof first) => page.data?.runs.map((run) => `${run.state} ${run.workItem.title}`);
  await then('the first page lists only the run of "Import reports from CSV" and names a "next" cursor', async () => {
    expect(first.response.status).toBe(200);
    expect(titles(first)).toEqual(["complete Import reports from CSV"]);
    expect(first.data?.next).toMatch(/^[\w-]+$/);
  });

  await then('the next page lists only the run of the README\'s "work.json"', async () => {
    expect(next.response.status).toBe(200);
    expect(titles(next)).toEqual([`complete ${TITLE}`]);
  });
});
