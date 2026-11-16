import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { openPaused, serveWorkbench } from "./workbench.ts";

const RENDERED = ["Import reports from CSV", "task", "received", "slack", "Varun", "—", "2 d"];
const NEW = ["Add a dark mode", "idea", "running", "console", "ada@acme.dev", "run-7", "1 min"];

scenario("SCN-UI-003", async ({ sut, given, when, then }) => {
  await given("the workbench is served with the console's Content-Security-Policy", async () => {
    await serveWorkbench(sut);
  });

  let page: BrowserPage;
  const loads: string[] = [];
  await when(
    'a person opens "/work-list/rows/", whose route answers "Add a dark mode" and "Import reports from CSV" every 10 seconds',
    async () => {
      page = await openPaused(sut, "/work-list/rows/");
      page.on("request", (request) => {
        if (request.url().endsWith(".json")) loads.push(new URL(request.url()).pathname);
      });
    },
  );

  await then(
    'the list shows the one row that the server rendered, "Import reports from CSV" with its link, its status and its age',
    async () => {
      expect(await page.getByRole("cell").allInnerTexts()).toEqual(RENDERED);
      expect(await page.getByRole("link", { name: "Import reports from CSV" }).getAttribute("href")).toBe(
        "https://example.com/issues/1",
      );
      expect(await page.getByRole("columnheader").allTextContents()).toEqual([
        "Work item",
        "Type",
        "Status",
        "Source",
        "Requester",
        "Run",
        "Age",
      ]);
    },
  );

  await then("9,999 milliseconds later it still shows only that row", async () => {
    await page.clock.runFor(9_999);
    expect(await page.getByRole("cell").allInnerTexts()).toEqual(RENDERED);
  });

  await then(
    '10 seconds later it shows "Add a dark mode" with the status "running" and the run "run-7" linked to "/runs/run-7", above "Import reports from CSV"',
    async () => {
      const answered = page.waitForResponse((response) => response.url().endsWith("/work-list/rows.json"));
      await page.clock.runFor(1);
      expect((await answered).status()).toBe(200);
      await page.getByRole("cell", { name: "Add a dark mode" }).waitFor();
      expect(await page.getByRole("cell").allInnerTexts()).toEqual([...NEW, ...RENDERED]);
      expect(await page.getByRole("link", { name: "run-7" }).getAttribute("href")).toBe("/runs/run-7");
      expect(await page.getByRole("link").allInnerTexts()).toEqual(["run-7", "Import reports from CSV"]);
      expect(loads).toEqual(["/work-list/rows.json"]);
      expect(await page.getByRole("alert").count()).toBe(0);
    },
  );
});
