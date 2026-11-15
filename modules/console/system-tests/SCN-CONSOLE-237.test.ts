import { type Page, scenario } from "@opensoftware/testkit";
import { ENGINEER } from "./changes.ts";
import { openSkill, servingSwitches } from "./switches.ts";

const LOCAL =
  "This factory is read from a local folder, so the console cannot change it. Set CONSOLE_FACTORY_REPOSITORY to its repository on a forge.";

scenario("SCN-CONSOLE-237", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer", without "CONSOLE_FACTORY_REPOSITORY"',
    async () => {
      await servingSwitches(sut, fakes, {});
    },
  );

  let page: Page;
  let asked: Page;
  await when(
    '"grace@acme.dev" opens "/skills/release-notes" and "/skills/release-notes/switch?agent=review"',
    async () => {
      [page, asked] = await Promise.all([
        openSkill(sut),
        sut.pages.open("/skills/release-notes/switch?agent=review", { headers: ENGINEER }),
      ]);
    },
  );

  await then(
    'the skill\'s page has no button and says "This factory is read from a local folder, so the console cannot change it. Set CONSOLE_FACTORY_REPOSITORY to its repository on a forge."',
    async () => {
      expect(page.status).toBe(200);
      expect(page.getByRole("main").queryAllByRole("button")).toEqual([]);
      expect(page.getByText(LOCAL).text).toBe(LOCAL);
    },
  );

  await then("the page that asks first answers 404 and says the same", async () => {
    expect(asked.status).toBe(404);
    expect(asked.text).toContain(LOCAL);
  });
});
