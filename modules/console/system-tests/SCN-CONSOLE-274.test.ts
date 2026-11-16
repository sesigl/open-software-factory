import { scenario } from "@opensoftware/testkit";
import { foreman, open, rows, serving } from "./console.ts";
import { IMPORT, IMPORT_ROW, workItemOf } from "./work.ts";

/** The `<script ...>...</script>` elements of a page's HTML: their attributes and their content. */
const scripts = (html: string) =>
  [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(([, attributes, content]) => ({
    attributes: attributes?.trim() ?? "",
    content,
  }));

scenario("SCN-CONSOLE-274", async ({ sut, fakes, given, when, then }) => {
  await given(
    'an intake whose inbox holds "Import reports from CSV", received two days ago, and a console with "CONSOLE_REFRESH" 10',
    async () => {
      const intake = await fakes.http([
        { path: "/v1/inbox", body: { workItems: [workItemOf(IMPORT)] } },
        { path: "/v1/inbox?cursor=Y3Vyc29y", body: { workItems: [] } },
      ]);
      await serving(sut, [(await foreman(fakes, [])).url], { CONSOLE_INTAKE_URL: intake.url, CONSOLE_REFRESH: "10" });
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  let html = "";
  await when('a person opens "/work"', async () => {
    page = await open(sut, "/work");
    html = String((await sut.http.get("/work")).body);
  });

  await then(
    'the region "Work items" lists "Import reports from CSV" and holds the island\'s properties: the route "/work/items", the interval 10000 milliseconds and the same row',
    async () => {
      const region = page.getByRole("region", { name: "Work items" });
      expect(rows(region)).toEqual([[IMPORT, "task", "received", "slack", "Varun", "—", "2 d"]]);
      expect(region.attribute("data-island")).toBe("work-list");
      expect(JSON.parse(region.attribute("data-props") ?? "")).toEqual({
        rows: [IMPORT_ROW],
        empty: false,
        src: "/work/items",
        interval: 10_000,
        columns: ["Work item", "Type", "Status", "Source", "Requester", "Run", "Age"],
        emptyText: "No work items yet. Work arrives from the factory's sources and from this form.",
        failedText: "The list could not be refreshed: it shows the work items as they were.",
      });
    },
  );

  await then(
    'the page loads one script, a module script of "/_astro/" that the console answers as JavaScript, and has no inline script',
    async () => {
      const found = scripts(html);
      expect(found).toEqual([
        { attributes: expect.stringMatching(/^type="module" src="\/_astro\/[\w.-]+\.js"$/), content: "" },
      ]);
      const src = /src="([^"]+)"/.exec(found[0]?.attributes ?? "")?.[1] ?? "";
      const file = await sut.http.get(src);
      expect([file.status, file.headers["content-type"]]).toEqual([200, "text/javascript; charset=utf-8"]);
      expect(String(file.body)).toContain("work-list");
    },
  );

  await then("the page asks only a browser without script to reload it after 10 seconds", async () => {
    expect(html).toContain('<noscript><meta http-equiv="refresh" content="10"></noscript>');
    expect(html.match(/http-equiv="refresh"/g)).toEqual(['http-equiv="refresh"']);
  });

  await then('on "/work?cursor=Y3Vyc29y" the island\'s route is "/work/items?cursor=Y3Vyc29y"', async () => {
    const second = (await open(sut, "/work?cursor=Y3Vyc29y")).getByRole("region", { name: "Work items" });
    expect(JSON.parse(second.attribute("data-props") ?? "").src).toBe("/work/items?cursor=Y3Vyc29y");
  });
});
