import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { openPaused, serveWorkbench } from "./workbench.ts";

const RENDERED = ["Import reports from CSV", "task", "received", "slack", "Varun", "—", "2 d"];

scenario("SCN-UI-009", async ({ sut, given, when, then }) => {
  await given("the workbench is served with the console's Content-Security-Policy", async () => {
    await serveWorkbench(sut);
  });

  let page: BrowserPage;
  await when('a person opens "/work-list/signed-out/", whose route answers an HTML page', async () => {
    page = await openPaused(sut, "/work-list/signed-out/");
  });

  await then(
    '10 seconds later the list still shows "Import reports from CSV", and the alert "The list could not be refreshed: it shows the work items as they were."',
    async () => {
      const answered = page.waitForResponse((response) => response.url().endsWith("/work-list/rows/"));
      await page.clock.runFor(10_000);
      expect((await answered).headers()["content-type"]).toBe("text/html; charset=utf-8");
      await page.getByRole("alert").waitFor();
      expect(await page.getByRole("alert").innerText()).toBe(
        "The list could not be refreshed: it shows the work items as they were.",
      );
      expect(await page.getByRole("cell").allInnerTexts()).toEqual(RENDERED);
    },
  );
});
