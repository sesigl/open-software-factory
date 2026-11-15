import { type Page, scenario } from "@opensoftware/testkit";
import { servingBody, skillMd } from "./skills.ts";

scenario("SCN-CONSOLE-200", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md links "Docs" to "https://docs.example/notes", "Plain" to "http://plain.example", "Mail" to "mailto:ada@acme.dev", and "Run", "Trick", "Open" and "Teams" to "javascript:alert(1)", "javascript:void(0)//https://evil.example", "data:text/html,hi" and "teams.md"',
    async () => {
      const lines = [
        "[Docs](https://docs.example/notes), [Plain](http://plain.example) and [Mail](mailto:ada@acme.dev).",
        "[Run](javascript:alert(1)), [Trick](javascript:void(0)//https://evil.example), [Open](data:text/html,hi) and [Teams](teams.md).",
      ];
      await servingBody(sut, fakes, lines.join("\n\n"));
    },
  );

  let page: Page;
  await when('a person opens "/skills/release-notes"', async () => {
    page = await sut.pages.open("/skills/release-notes");
  });

  await then(
    'the panel "SKILL.md" links only "Docs", "Plain" and "Mail", each with "rel" "nofollow noreferrer"',
    async () => {
      const found = skillMd(page)
        .queryAllByRole("link")
        .map((link) => [link.text, link.attribute("href"), link.attribute("rel")]);
      expect(found).toEqual([
        ["Docs", "https://docs.example/notes", "nofollow noreferrer"],
        ["Plain", "http://plain.example", "nofollow noreferrer"],
        ["Mail", "mailto:ada@acme.dev", "nofollow noreferrer"],
      ]);
    },
  );

  await then('it shows "Run", "Trick", "Open" and "Teams" as text', async () => {
    expect(skillMd(page).text).toBe("SKILL.md Docs , Plain and Mail . Run, Trick, Open and Teams.");
  });
});
