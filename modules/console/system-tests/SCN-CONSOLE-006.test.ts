import type { RunView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { foreman, open, rows, runOf, serving } from "./console.ts";

/** `count` running runs of the factory, each started a minute before the one before it. */
const runsOf = (factory: string, count: number): RunView[] =>
  Array.from({ length: count }, (_, index) =>
    runOf(`${factory} task ${index + 1}`, {
      runId: `run_${factory === "web" ? "a" : "b"}${String(index).padStart(19, "0")}`,
      factory,
      startedAt: new Date(Date.parse("2025-12-31T23:00:00Z") - index * 60_000).toISOString(),
    }),
  );

scenario("SCN-CONSOLE-006", async ({ sut, fakes, given, when, then }) => {
  let urls: string[] = [];
  await given(
    'a foreman of the factory "web" with 7 running runs and a foreman of the factory "mobile" with 5 running runs',
    async () => {
      urls = [(await foreman(fakes, runsOf("web", 7))).url, (await foreman(fakes, runsOf("mobile", 5))).url];
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    await serving(sut, urls);
    page = await open(sut, "/");
  });

  await then("the page lists 12 runs", async () => {
    expect(rows(page.html)).toHaveLength(12);
  });

  await then('7 rows name the factory "web" and 5 rows name the factory "mobile"', async () => {
    const factories = rows(page.html).map((row) => row[1]);
    expect(factories.filter((factory) => factory === "web")).toHaveLength(7);
    expect(factories.filter((factory) => factory === "mobile")).toHaveLength(5);
  });
});
