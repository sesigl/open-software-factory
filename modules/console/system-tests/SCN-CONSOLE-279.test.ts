import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { ADA, foreman, serving } from "./console.ts";
import { IMPORT, workItemOf } from "./work.ts";

const NEW = "Add a dark mode";

scenario("SCN-CONSOLE-279", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console behind a sign-in proxy with "CONSOLE_REFRESH" 10 and an intake whose inbox holds "Import reports from CSV", and "Add a dark mode" too from its second answer on',
    async () => {
      const intake = await fakes.http([
        { path: "/v1/inbox", times: 1, body: { workItems: [workItemOf(IMPORT)] } },
        { path: "/v1/inbox", body: { workItems: [workItemOf(NEW, "running"), workItemOf(IMPORT)] } },
        { method: "POST", path: "/v1/work-items", status: 201, body: {} },
      ]);
      // With the reload on: the island keeps the list fresh, so the page has no meta refresh for axe to flag.
      await serving(sut, [(await foreman(fakes, [])).url], {
        CONSOLE_REFRESH: "10",
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_INTAKE_URL: intake.url,
      });
    },
  );

  let page: BrowserPage;
  let loads = 0;
  await when(
    'the person "ada@acme.dev" opens "/work" in Chromium and types "Add a dark mode" into the field "Title"',
    async () => {
      page = await sut.browser.open("/work", { headers: ADA });
      page.on("load", () => {
        loads += 1;
      });
      await page.getByRole("textbox", { name: "Title" }).fill(NEW);
      // From here the page's timers run only when the scenario runs its clock; Playwright's actions wait for
      // animation frames, which a paused clock holds back, so the person typed first.
      await page.clock.pauseAt(new Date("2026-01-01T00:00:00Z"));
    },
  );

  await then(
    '10 seconds later the list shows "Add a dark mode" above "Import reports from CSV", the page was not loaded again, and the field "Title" still holds "Add a dark mode"',
    async () => {
      const answered = page.waitForResponse((response) => new URL(response.url()).pathname === "/work/items");
      await page.clock.runFor(10_000);
      expect((await answered).status()).toBe(200);
      const list = page.getByRole("region", { name: "Work items" });
      await list.getByRole("cell", { name: NEW }).waitFor();
      expect(await list.getByRole("link").allTextContents()).toEqual([NEW, IMPORT]);
      expect(await page.getByRole("textbox", { name: "Title" }).inputValue()).toBe(NEW);
      expect(loads).toBe(0);
    },
  );

  await then(
    'the work page passes the accessibility checks with the refresh on, and its screenshot is kept as "work-refreshed"',
    async () => {
      // axe waits on timers of its own, which run only while the clock runs.
      await page.clock.resume();
      await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
      await sut.browser.screenshot(page, "work-refreshed");
    },
  );
});
