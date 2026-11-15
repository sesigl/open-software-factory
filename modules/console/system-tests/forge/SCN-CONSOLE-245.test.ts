import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { type Change, changeOfConsole, ENGINEER, postCheck } from "../changes.ts";

scenario("SCN-CONSOLE-245", async ({ sut, fakes, given, when, then }) => {
  let change: Change;
  await given('a change of the console whose check "factory" failed, and a console without the reload', async () => {
    // Without the reload: axe's rule meta-refresh flags it until live updates replace it (TODO.md, T-60).
    change = await changeOfConsole(sut, fakes, { CONSOLE_REFRESH: "0" });
    await postCheck(change, "failure");
  });

  let page: BrowserPage;
  await when('the factory engineer opens "/changes" in Chromium', async () => {
    page = await sut.browser.open("/changes", { headers: ENGINEER });
    await page.getByRole("list", { name: "Changes" }).waitFor();
  });

  await then('the change has the buttons "Try again" and "Discard"', async () => {
    const row = page.getByRole("list", { name: "Changes" }).getByRole("listitem");
    expect(await row.getByText("Failed", { exact: true }).isVisible()).toBe(true);
    expect(await row.getByRole("button").allInnerTexts()).toEqual(["Try again", "Discard"]);
  });

  await then('the page passes the accessibility checks, and its screenshot is kept as "changes-failed"', async () => {
    await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
    await sut.browser.screenshot(page, "changes-failed");
  });
});
