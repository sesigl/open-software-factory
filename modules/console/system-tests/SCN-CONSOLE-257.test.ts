import type { WorkItemView } from "@opensoftware/contracts";
import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { ADA, foreman, proposalForge, runOf, serving } from "./console.ts";

const WORK_ITEM = "Import reports from CSV";
const PROPOSAL = "Triage asks before it investigates";

scenario("SCN-CONSOLE-257", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'a console behind a sign-in proxy with an intake whose inbox holds "Import reports from CSV", received two days ago, and the inbox of "tester/web" with the proposal "Triage asks before it investigates"',
    async () => {
      // Two days before the testkit's clock, 2026-01-01T00:00:00Z.
      const item: WorkItemView = {
        workItem: runOf(WORK_ITEM).workItem,
        status: "received",
        receivedAt: "2025-12-30T00:00:00Z",
        requests: [],
      };
      intake = await fakes.http([
        { path: "/v1/inbox", body: { workItems: [item] } },
        { method: "POST", path: "/v1/work-items", status: 201, body: {} },
      ]);
      const { forge } = await proposalForge(fakes, [{ branch: "observer/triage-inline-1a2b3c4d", title: PROPOSAL }]);
      // The work page has no reload since its island (ADR 0152), and SCN-CONSOLE-279 runs it with one; here the island
      // loads nothing, so no load of its list is cut off when the form sends the page away.
      await serving(sut, [(await foreman(fakes, [])).url], {
        CONSOLE_REFRESH: "0",
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_INTAKE_URL: intake.url,
        CONSOLE_INBOX_REPOSITORY: "tester/web",
        CONSOLE_FORGE_ADAPTER: sut.adapter("forge/github"),
        CONSOLE_FORGE_URL: forge.url,
        CONSOLE_FORGE_TOKEN: forge.token,
      });
    },
  );

  let page: BrowserPage;
  await when('the person "ada@acme.dev" opens "/inbox" on a phone', async () => {
    page = await sut.browser.open("/inbox", { viewport: "phone", headers: ADA });
  });

  const width = () => page.viewportSize()?.width ?? 0;
  const box = async (locator: ReturnType<BrowserPage["getByRole"]>) => {
    const found = await locator.boundingBox();
    if (!found) throw new Error("the element has no box");
    return found;
  };
  /** The card of the table's only row: its box, and those of its title, its state and its age in these cells. */
  const card = async (state: number, age: number) => {
    const rows = page
      .getByRole("table")
      .getByRole("row")
      .filter({ has: page.getByRole("cell") });
    expect(await rows.count()).toBe(1);
    const row = rows.first();
    return {
      card: await box(row),
      title: await box(row.getByRole("cell").nth(0)),
      state: await box(row.getByRole("cell").nth(state)),
      age: await box(row.getByRole("cell").nth(age)),
      texts: await row.getByRole("cell").allInnerTexts(),
    };
  };
  const above = (found: Awaited<ReturnType<typeof card>>) => {
    expect(found.card.width).toBeGreaterThan(width() - 40);
    expect(found.card.x + found.card.width).toBeLessThanOrEqual(width());
    expect(found.state.y + found.state.height).toBeLessThanOrEqual(found.title.y);
    expect(found.age.y + found.age.height).toBeLessThanOrEqual(found.title.y);
    expect(found.age.x).toBeGreaterThan(found.state.x);
  };

  await then(
    'each proposal is a card across the screen with its state and age above its title, and the page passes the accessibility checks; its screenshot is kept as "inbox-phone"',
    async () => {
      const proposal = await card(3, 4);
      above(proposal);
      expect(proposal.texts.slice(0, 4)).toEqual([
        PROPOSAL,
        "observer/triage-inline-1a2b3c4d",
        "github:tester",
        "needs review",
      ]);
      await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
      await sut.browser.screenshot(page, "inbox-phone");
    },
  );

  await then(
    'on "/work" the work item is a card with its status and the age "2 d" above its title, and the fields "Title", "Type" and "Description" stand in one column inside the screen',
    async () => {
      page = await sut.browser.open("/work", { viewport: "phone", headers: ADA });
      const work = await card(2, 6);
      above(work);
      expect(work.texts).toEqual([WORK_ITEM, "task", "received", "slack", "Varun", "—", "2 d"]);
      const fields = [
        await box(page.getByRole("textbox", { name: "Title" })),
        await box(page.getByRole("combobox", { name: "Type" })),
        await box(page.getByRole("textbox", { name: "Description" })),
      ];
      for (const [index, field] of fields.entries()) {
        expect(field.x).toBe(fields[0]?.x);
        expect(field.x + field.width).toBeLessThanOrEqual(width());
        expect(field.width).toBeGreaterThan(width() / 2);
        if (index > 0) expect(field.y).toBeGreaterThan((fields[index - 1]?.y ?? 0) + 1);
      }
    },
  );

  await then('the work page passes the accessibility checks, and its screenshot is kept as "work-phone"', async () => {
    await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
    await sut.browser.screenshot(page, "work-phone");
  });

  await then(
    'after "Submit" with the title "Add a dark mode" and the type "idea" the browser is back on "/work"',
    async () => {
      await page.getByRole("textbox", { name: "Title" }).fill("Add a dark mode");
      await page.getByRole("combobox", { name: "Type" }).selectOption("idea");
      const sent = page.waitForResponse((response) => response.request().method() === "POST");
      await page.getByRole("button", { name: "Submit" }).click();
      expect((await sent).status()).toBe(303);
      await page.waitForLoadState();
      expect(new URL(page.url()).pathname).toBe("/work");
      await expect(page.getByRole("heading", { level: 1 }).textContent()).resolves.toBe("Work");
    },
  );

  await then(
    'intake received the submission "Add a dark mode" of the type "idea" from the person "ada@acme.dev"',
    async () => {
      const posted = intake.received().filter(({ method }) => method === "POST");
      expect(posted.map(({ body }) => body)).toEqual([
        expect.objectContaining({
          title: "Add a dark mode",
          type: "idea",
          requester: { kind: "person", id: "ada@acme.dev" },
          origin: expect.objectContaining({ source: "console" }),
        }),
      ]);
    },
  );
});
