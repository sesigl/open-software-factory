import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { foreman, runOf, serving } from "./console.ts";

const WAITING = "Approve the CSV export";
const runId = (n: number) => `run_${n.toString(16).padStart(20, "0")}`;

scenario("SCN-CONSOLE-246", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with intake and a foreman with 12 runs, of which "Approve the CSV export" waits for a person',
    async () => {
      const runs = [
        runOf(WAITING, { runId: runId(1), state: "blocked" }),
        ...Array.from({ length: 11 }, (_, n) => runOf(`Export report ${n + 2} as CSV`, { runId: runId(n + 2) })),
      ];
      // Without the reload: axe's rule meta-refresh flags it until live updates replace it (TODO.md, T-60). The runs
      // page asks intake nothing: its address only offers "Submit work".
      await serving(sut, [(await foreman(fakes, runs)).url], {
        CONSOLE_REFRESH: "0",
        CONSOLE_INTAKE_URL: "http://127.0.0.1:1",
      });
    },
  );

  let page: BrowserPage;
  await when('a person opens "/" on a phone', async () => {
    page = await sut.browser.open("/", { viewport: "phone" });
  });

  const width = () => page.viewportSize()?.width ?? 0;
  const table = () => page.getByRole("table");
  const runRows = () =>
    table()
      .getByRole("row")
      .filter({ has: page.getByRole("cell") });
  const box = async (locator: ReturnType<BrowserPage["getByRole"]>) => {
    const found = await locator.boundingBox();
    if (!found) throw new Error("the element has no box");
    return found;
  };

  await then(
    "each run is a card across the screen with its state and age above its title, and no card or filter reaches past the screen's edge",
    async () => {
      expect(await runRows().count()).toBe(12);
      for (const row of await runRows().all()) {
        const card = await box(row);
        const title = await box(row.getByRole("link").first());
        const state = await box(row.getByRole("cell").nth(2));
        const age = await box(row.getByRole("cell").nth(6));
        expect(card.width).toBeGreaterThan(width() - 40);
        expect(card.x + card.width).toBeLessThanOrEqual(width());
        expect(state.y + state.height).toBeLessThanOrEqual(title.y);
        expect(age.y + age.height).toBeLessThanOrEqual(title.y);
        expect(age.x).toBeGreaterThan(state.x);
      }
      const filters = await box(page.getByRole("navigation", { name: "States" }).getByRole("list"));
      const filter = await box(page.getByRole("link", { name: "all", exact: true }));
      expect(filters.x + filters.width).toBeLessThanOrEqual(width());
      expect(filters.height).toBeLessThan(2 * filter.height);
    },
  );

  await then("each card is still a row of the runs' table, with its cells", async () => {
    expect(await table().getByRole("columnheader").allTextContents()).toEqual([
      "Run",
      "Factory",
      "State",
      "Source",
      "Requester",
      "Pull request",
      "Age",
    ]);
    const cells = await table()
      .getByRole("row", { name: new RegExp(WAITING) })
      .getByRole("cell")
      .allInnerTexts();
    expect(cells).toEqual([WAITING, "web", "blocked", "slack", "Varun", "—", "5 min"]);
  });

  const submit = () => page.getByRole("link", { name: "Submit work" });

  await then(
    '"Submit work" stays at the bottom of the screen after scrolling to the last run, and covers no run',
    async () => {
      const height = page.viewportSize()?.height ?? 0;
      const before = await box(submit());
      expect(before.y + before.height).toBeGreaterThan(height - 20);
      expect(before.width).toBeGreaterThan(width() - 40);
      await page.keyboard.press("End");
      await expect
        .poll(async () => (await box(runRows().last())).y + (await box(runRows().last())).height)
        .toBeLessThanOrEqual(before.y - 12);
      expect((await box(submit())).y).toBe(before.y);
    },
  );

  await then('the page passes the accessibility checks, and its screenshot is kept as "runs-phone"', async () => {
    await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
    await sut.browser.screenshot(page, "runs-phone");
  });

  await then('a tap on the card of "Approve the CSV export" beside its title opens its run', async () => {
    const row = table().getByRole("row", { name: new RegExp(WAITING) });
    const card = await box(row);
    await row.click({ position: { x: card.width - 8, y: card.height - 8 } });
    await page.waitForURL(`**/runs/${runId(1)}`);
    expect(new URL(page.url()).pathname).toBe(`/runs/${runId(1)}`);
  });
});
