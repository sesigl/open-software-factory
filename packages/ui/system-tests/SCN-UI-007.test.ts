import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { pause, serveWorkbench } from "./workbench.ts";

scenario("SCN-UI-007", async ({ sut, given, when, then }) => {
  await given("the workbench is served with the console's Content-Security-Policy", async () => {
    await serveWorkbench(sut);
  });

  let page: BrowserPage;
  await when('a person opens "/work-list/rows/" and types "Add a dark mode" into the field "Title"', async () => {
    page = await sut.browser.open("/work-list/rows/");
    await page.getByRole("textbox", { name: "Title" }).fill("Add a dark mode");
    await pause(page);
  });

  await then(
    '10 seconds later the list shows "Add a dark mode" and the field "Title" still holds "Add a dark mode"',
    async () => {
      await page.clock.runFor(10_000);
      await page.getByRole("cell", { name: "Add a dark mode" }).waitFor();
      expect(await page.getByRole("cell", { name: "Add a dark mode" }).innerText()).toBe("Add a dark mode");
      expect(await page.getByRole("textbox", { name: "Title" }).inputValue()).toBe("Add a dark mode");
      expect(await page.getByRole("heading", { level: 1 }).innerText()).toBe("Work list with rows");
    },
  );

  await then("the page passes the accessibility checks", async () => {
    // axe waits on timers of its own, which run only while the clock runs.
    await page.clock.resume();
    await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
  });
});
