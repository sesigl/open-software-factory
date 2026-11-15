import { type Page, scenario } from "@opensoftware/testkit";
import { servingBody, skillMd } from "./skills.ts";

scenario("SCN-CONSOLE-205", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md holds the link "Ref" by reference to "javascript:alert(1)", the autolink "<javascript:alert(2)>", the link "Item" to "javascript:alert(3)" in a list and the link "Quote" to "javascript:alert(4)" in a quote',
    async () => {
      const lines = [
        "[Ref][r] and <javascript:alert(2)>.",
        "- [Item](javascript:alert(3))",
        "> [Quote](javascript:alert(4))",
        "[r]: javascript:alert(1)",
      ];
      await servingBody(sut, fakes, lines.join("\n\n"));
    },
  );

  let page: Page;
  await when('a person opens "/skills/release-notes"', async () => {
    page = await sut.pages.open("/skills/release-notes");
  });

  await then('the panel "SKILL.md" has no link', async () => {
    expect(page.status).toBe(200);
    expect(skillMd(page).queryAllByRole("link")).toEqual([]);
  });

  await then('it shows "Ref", "javascript:alert(2)", "Item" and "Quote" as text', async () => {
    expect(skillMd(page).text).toBe("SKILL.md Ref and javascript:alert(2). Item Quote");
  });
});
