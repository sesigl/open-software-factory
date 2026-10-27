import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, RUN, rows, rowWith, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-005", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given(
    'a foreman with the run "Export reports as CSV" from "slack", asked by "Varun", started at "2025-12-31T23:55:00Z" with the pull request "https://github.com/acme/web/pull/7"',
    async () => {
      api = await foreman(fakes, [
        runOf("Export reports as CSV", { pullRequest: "https://github.com/acme/web/pull/7" }),
      ]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/" at "2026-01-01T00:00:00Z"', async () => {
    await serving(sut, [api.url], { OSF_NOW: "2026-01-01T00:00:00Z" });
    page = await open(sut, "/");
  });

  await then('the run\'s row shows "Export reports as CSV", "slack", "Varun" and the age "5 min"', async () => {
    expect(rows(page.html)).toEqual([
      ["Export reports as CSV", "web", "running", "slack", "Varun", "https://github.com/acme/web/pull/7", "5 min"],
    ]);
  });

  await then('the row links the pull request "https://github.com/acme/web/pull/7"', async () => {
    expect(links(rowWith(page.html, "Export reports as CSV"))).toContainEqual({
      href: "https://github.com/acme/web/pull/7",
      text: "https://github.com/acme/web/pull/7",
    });
  });

  await then('the row links the run\'s page "/runs/run_5d41402abc4b2a76b971"', async () => {
    expect(links(rowWith(page.html, "Export reports as CSV"))).toContainEqual({
      href: `/runs/${RUN}`,
      text: "Export reports as CSV",
    });
  });
});
