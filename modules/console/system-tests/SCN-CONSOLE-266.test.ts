import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { factoryEnv, healthyServer, serving, TOKEN_ROUTES } from "./console.ts";
import { lines, runRecord, score } from "./improvement.ts";

scenario("SCN-CONSOLE-266", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with the factory "acme" and its agent "triage", a healthy foreman, and a folder of cost and scores with the stage "implement" of "run_a" and the scorer "redundant-tests"',
    async () => {
      const foreman = await healthyServer(fakes, [{ name: "temporal", ok: true }], TOKEN_ROUTES.foreman);
      await sut.files.put("$INPUT/improve/runs.jsonl", lines([runRecord("run_a", "implement", "succeeded", 0.25)]));
      await sut.files.put("$INPUT/improve/scores.jsonl", lines([score("redundant-tests", "run_a", 1, 0.01)]));
      // Without the reload: axe's rule meta-refresh flags it until live updates replace it (TODO.md, T-60).
      await serving(sut, [foreman.url], {
        ...(await factoryEnv(sut)),
        CONSOLE_REFRESH: "0",
        CONSOLE_IMPROVE_DIR: sut.files.path("$INPUT/improve"),
      });
    },
  );

  let page: BrowserPage;
  await when('a person opens "/health" on a phone', async () => {
    page = await sut.browser.open("/health", { viewport: "phone" });
  });

  const width = () => page.viewportSize()?.width ?? 0;
  const box = async (locator: ReturnType<BrowserPage["getByRole"]>) => {
    const found = await locator.boundingBox();
    if (!found) throw new Error("the element has no box");
    return found;
  };
  /** The rows of the page's tables that hold cells, not the rows of their headers. */
  const rows = (table = 0) =>
    page
      .getByRole("table")
      .nth(table)
      .getByRole("row")
      .filter({ has: page.getByRole("cell") });
  /** The row's card is across the screen and inside it. */
  const across = async (row: ReturnType<typeof rows>) => {
    const card = await box(row);
    expect(card.width).toBeGreaterThan(width() - 40);
    expect(card.x + card.width).toBeLessThanOrEqual(width());
    return card;
  };
  /** The cell `above` of the row ends before the cell `below` starts. */
  const above = async (row: ReturnType<typeof rows>, upper: number, lower: number) => {
    const top = await box(row.getByRole("cell").nth(upper));
    expect(top.y + top.height).toBeLessThanOrEqual((await box(row.getByRole("cell").nth(lower))).y);
  };

  await then(
    'the check "foreman token" is a card across the screen with its state "ok" above its name, and the page passes the accessibility checks; its screenshot is kept as "health-phone"',
    async () => {
      const row = rows().filter({ hasText: "foreman token" });
      await across(row);
      expect((await row.getByRole("cell").allInnerTexts()).slice(0, 2)).toEqual(["foreman token", "ok"]);
      await above(row, 1, 0);
      await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
      await sut.browser.screenshot(page, "health-phone");
    },
  );

  await then(
    'after "Menu" and "Factory" the agent "triage" is a card across the screen, and the page passes the accessibility checks; its screenshot is kept as "factory-phone"',
    async () => {
      await page.getByText("Menu", { exact: true }).click();
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Factory" }).click();
      await page.waitForLoadState();
      expect(new URL(page.url()).pathname).toBe("/factory");
      await across(rows().first());
      expect(await rows().first().getByRole("cell").allInnerTexts()).toEqual([
        "triage",
        "claude-code",
        "routes/triage",
        expect.stringContaining("high"),
      ]);
      await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
      await sut.browser.screenshot(page, "factory-phone");
    },
  );

  await then(
    'a tap on the card opens "/factory/agents/triage", whose facts stand inside the screen, and the page passes the accessibility checks',
    async () => {
      const card = await box(rows().first());
      await rows()
        .first()
        .click({ position: { x: card.width - 8, y: card.height - 8 } });
      await page.waitForURL("**/factory/agents/triage");
      await page.waitForLoadState();
      const facts = page.getByRole("definition");
      expect(await facts.count()).toBe(4);
      for (const fact of await facts.all()) {
        const found = await box(fact);
        expect(found.x + found.width).toBeLessThanOrEqual(width());
      }
      await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
    },
  );

  await then(
    'on "/improvement" the scorer and the stage are cards across the screen, the stage\'s outcome above its run, and the page passes the accessibility checks; its screenshot is kept as "improvement-phone"',
    async () => {
      page = await sut.browser.open("/improvement", { viewport: "phone" });
      await across(rows(0).first());
      const stage = rows(1).first();
      await across(stage);
      expect((await stage.getByRole("cell").allInnerTexts()).slice(0, 3)).toEqual(["run_a", "implement", "succeeded"]);
      await above(stage, 2, 0);
      await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
      await sut.browser.screenshot(page, "improvement-phone");
    },
  );
});
