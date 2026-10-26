import { scenario } from "@opensoftware/testkit";
import { foreman, open, rows, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-007", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given(
    'a foreman with the run "Fix login" that ended at "2025-12-31T23:00:00Z", the run "Add search" started at "2025-12-31T22:00:00Z" and the run "Export reports as CSV" started at "2025-12-31T23:30:00Z"',
    async () => {
      api = await foreman(fakes, [
        runOf("Fix login", {
          runId: "run_00000000000000000001",
          state: "complete",
          startedAt: "2025-12-31T22:30:00.000Z",
          endedAt: "2025-12-31T23:00:00.000Z",
        }),
        runOf("Add search", { runId: "run_00000000000000000002", startedAt: "2025-12-31T22:00:00.000Z" }),
        runOf("Export reports as CSV", { runId: "run_00000000000000000003", startedAt: "2025-12-31T23:30:00.000Z" }),
      ]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    await serving(sut, [api.url]);
    page = await open(sut, "/");
  });

  await then('the rows are "Export reports as CSV", "Add search" and "Fix login" in this order', async () => {
    expect(rows(page.html).map((row) => [row[0], row[6]])).toEqual([
      ["Export reports as CSV", "30 min"],
      ["Add search", "2 h"],
      ["Fix login", "1 h"],
    ]);
  });
});
