import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { openPaused, serveWorkbench } from "./workbench.ts";

const EMPTY = "No work items yet. Work arrives from the factory's sources and from this form.";

scenario("SCN-UI-004", async ({ sut, given, when, then }) => {
  await given("the workbench is served with the console's Content-Security-Policy", async () => {
    await serveWorkbench(sut);
  });

  let page: BrowserPage;
  await when('a person opens "/work-list/empty/", whose route answers no work item every 10 seconds', async () => {
    page = await openPaused(sut, "/work-list/empty/");
  });

  await then('the list shows "Import reports from CSV" and no empty text', async () => {
    expect(await page.getByRole("cell").first().innerText()).toBe("Import reports from CSV");
    expect(await page.getByText(EMPTY).count()).toBe(0);
  });

  await then(
    `10 seconds later it shows "No work items yet. Work arrives from the factory's sources and from this form." and no row`,
    async () => {
      const answered = page.waitForResponse((response) => response.url().endsWith("/work-list/empty.json"));
      await page.clock.runFor(10_000);
      expect((await answered).status()).toBe(200);
      await page.getByText(EMPTY).waitFor();
      expect(await page.getByText(EMPTY).innerText()).toBe(EMPTY);
      expect(await page.getByRole("cell").count()).toBe(0);
    },
  );
});
