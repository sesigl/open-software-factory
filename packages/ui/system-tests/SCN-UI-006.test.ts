import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { openPaused, serveWorkbench } from "./workbench.ts";

const RENDERED = ["Import reports from CSV", "task", "received", "slack", "Varun", "—", "2 d"];

scenario("SCN-UI-006", async ({ sut, given, when, then }) => {
  await given("the workbench is served with the console's Content-Security-Policy", async () => {
    await serveWorkbench(sut);
  });

  let page: BrowserPage;
  const loads: string[] = [];
  await when('a person opens "/work-list/off/", whose route answers a new work item, with the interval 0', async () => {
    page = await openPaused(sut, "/work-list/off/");
    page.on("request", (request) => {
      if (request.url().endsWith(".json")) loads.push(new URL(request.url()).pathname);
    });
  });

  await then('a minute later the list still shows only "Import reports from CSV"', async () => {
    await page.clock.runFor(60_000);
    expect(await page.getByRole("cell").allInnerTexts()).toEqual(RENDERED);
    expect(loads).toEqual([]);
  });
});
