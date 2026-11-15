import { scenario } from "@opensoftware/testkit";
import { foreman, links, NEW_RUN, navLinks, open, RUN, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-247", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given(
    'a foreman with the running run "Export reports as CSV" and the failed run "Add a dark mode"',
    async () => {
      api = await foreman(fakes, [
        runOf("Export reports as CSV", { stages: [{ stage: "implement", agent: "developer", state: "running" }] }),
        runOf("Add a dark mode", { runId: NEW_RUN, state: "failed" }),
      ]);
    },
  );

  let pages: Awaited<ReturnType<typeof open>>[] = [];
  await when('a person opens the page of each run in a console without "CONSOLE_USER_HEADER"', async () => {
    await serving(sut, [api.url]);
    pages = [await open(sut, `/runs/${RUN}`), await open(sut, `/runs/${NEW_RUN}`)];
  });

  await then(
    'each page has the title of its run, the navigation "Main" with "Runs" as the current page and the way back "Runs"',
    async () => {
      expect(pages.map((page) => [page.status, page.title])).toEqual([
        [200, "Export reports as CSV · Open Software Factory"],
        [200, "Add a dark mode · Open Software Factory"],
      ]);
      for (const page of pages) {
        const current = page.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
        expect([current.text, current.attribute("href")]).toEqual(["Runs", "/"]);
        expect(links(page.getByRole("main"))[0]).toEqual({ href: "/", text: "Runs" });
        expect(navLinks(page)).toContainEqual({ href: "/health", text: "Health" });
      }
    },
  );

  await then('neither page links "/pico.css" or has a form', async () => {
    expect(pages.map((page) => page.stylesheets.filter((href) => href === "/pico.css"))).toEqual([[], []]);
    expect(pages.map((page) => page.stylesheets.some((href) => href.startsWith("/_astro/")))).toEqual([true, true]);
    expect(pages.map((page) => [page.forms, page.queryAllByRole("button")])).toEqual([
      [[], []],
      [[], []],
    ]);
  });

  await then("each page asks the browser to reload it after 10 seconds", async () => {
    expect(pages.map((page) => page.refresh)).toEqual([10, 10]);
  });
});
