import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { ADA, foreman, GATE, gatedRun, pendingGate, RUN, serving } from "./console.ts";

scenario("SCN-CONSOLE-249", async ({ sut, fakes, given, when, then }) => {
  let gatekeeper: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'a console behind a sign-in proxy, a foreman with a run whose stage "ship" waits at the gate "g0123456789abcdef", and gatekeeper whose gate is "pending" for "leads"',
    async () => {
      const api = await foreman(fakes, [gatedRun()]);
      gatekeeper = await fakes.http([
        { path: `/v1/gates/${GATE}`, body: pendingGate },
        { method: "POST", path: `/v1/gates/${GATE}/decisions`, body: { ...pendingGate, state: "rejected" } },
      ]);
      // Without the reload: axe's rule meta-refresh flags it until live updates replace it (TODO.md, T-60).
      await serving(sut, [api.url], {
        CONSOLE_REFRESH: "0",
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_GATEKEEPER_URL: gatekeeper.url,
      });
    },
  );

  let page: BrowserPage;
  await when('the person "ada@acme.dev" opens the run\'s page on a phone', async () => {
    page = await sut.browser.open(`/runs/${RUN}`, { viewport: "phone", headers: ADA });
  });

  const width = () => page.viewportSize()?.width ?? 0;
  const box = async (locator: ReturnType<BrowserPage["getByRole"]>) => {
    const found = await locator.boundingBox();
    if (!found) throw new Error("the element has no box");
    return found;
  };

  await then(
    "each stage is a card across the screen with its state above its name, and nothing reaches past the screen's edge",
    async () => {
      const stages = page
        .getByRole("table")
        .getByRole("row")
        .filter({ has: page.getByRole("cell") });
      expect(await stages.count()).toBe(2);
      for (const row of await stages.all()) {
        const card = await box(row);
        const name = await box(row.getByRole("cell").nth(0));
        const state = await box(row.getByRole("cell").nth(2));
        expect(card.width).toBeGreaterThan(width() - 40);
        expect(card.x + card.width).toBeLessThanOrEqual(width());
        expect(state.y + state.height).toBeLessThanOrEqual(name.y);
      }
      const controls = [...(await page.getByRole("button").all()), ...(await page.getByRole("textbox").all())];
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        const { x, width: across } = await box(control);
        expect(x + across).toBeLessThanOrEqual(width());
      }
    },
  );

  await then('the page passes the accessibility checks, and its screenshot is kept as "run-phone"', async () => {
    await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
    await sut.browser.screenshot(page, "run-phone");
  });

  await then('after "Reject" with the reason "needs a test" the browser is back on the run\'s page', async () => {
    await page.getByLabel("Reason").fill("needs a test");
    const decided = page.waitForResponse((response) => response.url().endsWith(`/runs/${RUN}/gates/${GATE}`));
    await page.getByRole("button", { name: "Reject" }).click();
    expect((await decided).status()).toBe(303);
    await page.waitForLoadState();
    expect(new URL(page.url()).pathname).toBe(`/runs/${RUN}`);
    await expect(page.getByRole("heading", { level: 1 }).textContent()).resolves.toBe("Export reports as CSV");
  });

  await then(
    'gatekeeper received the decision "rejected" with the reason "needs a test" by the person "ada@acme.dev"',
    async () => {
      const posted = gatekeeper.received().filter(({ method }) => method === "POST");
      expect(posted.map(({ body }) => body)).toEqual([
        { decision: "rejected", by: { kind: "person", id: "ada@acme.dev" }, reason: "needs a test" },
      ]);
    },
  );
});
