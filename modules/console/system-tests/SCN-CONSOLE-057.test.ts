import { type Page, scenario } from "@opensoftware/testkit";
import { foreman, links, open, rows, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-057", async ({ sut, fakes, given, when, then }) => {
  const first = runOf("Import reports from CSV", { runId: "run_00000000000000000001" });
  const later = runOf("Archive old reports", { runId: "run_00000000000000000002" });
  const other = runOf("Export reports as CSV", { runId: "run_00000000000000000003" });
  let paged: Awaited<ReturnType<typeof foreman>>;
  let second: Awaited<ReturnType<typeof foreman>>;
  await given(
    'a foreman whose first page holds the run "Import reports from CSV" and whose next page holds "Archive old reports"',
    async () => {
      paged = await foreman(
        fakes,
        [],
        [
          { path: "/v1/runs", body: { runs: [first], next: "cursor-1" } },
          { path: "/v1/runs?cursor=cursor-1", body: { runs: [later] } },
        ],
      );
    },
  );

  await given('a second foreman with the run "Export reports as CSV" and no next page', async () => {
    second = await foreman(fakes, [other]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  let next: Awaited<ReturnType<typeof open>>;
  const nextHref = (shown: Page) => links(shown).find((link) => link.text === "Next page")?.href;
  await when('a person opens "/" and then its link "Next page"', async () => {
    await serving(sut, [paged.url, second.url]);
    page = await open(sut, "/");
    next = await open(sut, nextHref(page) as string);
  });

  const titles = (shown: Page) => rows(shown).map((row) => row[0]);
  await then(
    'the first page lists "Import reports from CSV" and "Export reports as CSV" and links "Next page"',
    async () => {
      expect(page.status).toBe(200);
      expect(titles(page).sort()).toEqual(["Export reports as CSV", "Import reports from CSV"]);
      expect(nextHref(page)).toMatch(/^\/\?page=[\w-]+$/);
    },
  );

  await then('the next page lists only "Archive old reports" and links no "Next page"', async () => {
    expect(next.status).toBe(200);
    expect(titles(next)).toEqual(["Archive old reports"]);
    expect(nextHref(next)).toBeUndefined();
  });

  await then("the second foreman was asked only for its first page", async () => {
    expect(paged.headers().map((request) => request.path)).toEqual(["/v1/runs", "/v1/runs?cursor=cursor-1"]);
    expect(second.headers().map((request) => request.path)).toEqual(["/v1/runs"]);
  });

  await then('the page "/?page=bm90LWEtcGFnZQ", which no foreman named, answers 400', async () => {
    for (const bad of [
      "bm90LWEtcGFnZQ",
      Buffer.from('["one"]').toString("base64url"),
      Buffer.from("[1,2]").toString("base64url"),
    ])
      expect((await open(sut, `/?page=${bad}`)).status).toBe(400);
    expect((await open(sut, `/?page=${Buffer.from('["cursor-1",null]').toString("base64url")}`)).status).toBe(200);
  });
});
