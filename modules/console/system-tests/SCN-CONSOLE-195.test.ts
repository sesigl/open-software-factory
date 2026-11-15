import { type Page, scenario } from "@opensoftware/testkit";
import { servingOpen, skillOf } from "./skills.ts";

scenario("SCN-CONSOLE-195", async ({ sut, fakes, given, when, then }) => {
  await given('a factory whose agent "triage" uses the skill "release-notes"', async () => {
    await servingOpen(sut, fakes, { triage: {} }, [skillOf("release-notes", { triage: {} })]);
  });

  let page: Page;
  await when('a person opens "/skills/changelog"', async () => {
    page = await sut.pages.open("/skills/changelog");
  });

  await then(
    'the page "changelog" answers 404 and says "no skill changelog: no agent of the factory uses it"',
    async () => {
      expect([page.status, page.title]).toEqual([404, "changelog · Open Software Factory"]);
      expect(page.text).toContain("no skill changelog: no agent of the factory uses it");
    },
  );
});
