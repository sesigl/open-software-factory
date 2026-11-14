import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { foreman, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-164", async ({ sut, fakes, given, when, then }) => {
  await given('a foreman with the run "Export reports as CSV"', async () => {
    // Without the reload: axe's rule meta-refresh flags it until live updates replace it (TODO.md, T-60).
    await serving(sut, [(await foreman(fakes, [runOf("Export reports as CSV")])).url], { CONSOLE_REFRESH: "0" });
  });

  let page: BrowserPage;
  await when('a person opens "/" on a phone', async () => {
    page = await sut.browser.open("/", { viewport: "phone" });
  });

  const navigation = () => page.getByRole("navigation", { name: "Main" });

  await then('the run "Export reports as CSV" shows and the navigation\'s link "Health" does not', async () => {
    expect(await page.getByRole("link", { name: "Export reports as CSV" }).isVisible()).toBe(true);
    expect(await navigation().getByRole("link", { name: "Health" }).isVisible()).toBe(false);
  });

  await then('after "Menu" the navigation shows "Runs", "Factory" and "Health"', async () => {
    await page.getByText("Menu", { exact: true }).click();
    for (const name of ["Runs", "Factory", "Health"])
      expect(await navigation().getByRole("link", { name, exact: true }).isVisible()).toBe(true);
  });

  await then('the page passes the accessibility checks, and its screenshot is kept as "phone-menu"', async () => {
    await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
    await sut.browser.screenshot(page, "phone-menu");
  });
});
