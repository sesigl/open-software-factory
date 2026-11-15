import { type Page, scenario } from "@opensoftware/testkit";
import { servingOpen, skillMd, skillOf, skillRows } from "./skills.ts";

const NO_DESCRIPTION =
  "skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it";

scenario("SCN-CONSOLE-196", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md has no description, and the skill "missing" whose folder has no SKILL.md',
    async () => {
      await servingOpen(sut, fakes, { triage: {} }, [
        skillOf(
          "missing",
          { triage: {} },
          {
            description: null,
            files: ["README.md"],
            body: null,
            problems: ['the skill "./skills/missing" has no SKILL.md'],
          },
        ),
        skillOf("release-notes", { triage: {} }, { description: null, problems: [NO_DESCRIPTION] }),
      ]);
    },
  );

  let list: Page;
  let notes: Page;
  let missing: Page;
  await when('a person opens "/skills", "/skills/release-notes" and "/skills/missing"', async () => {
    list = await sut.pages.open("/skills");
    notes = await sut.pages.open("/skills/release-notes");
    missing = await sut.pages.open("/skills/missing");
  });

  await then('the list says "release-notes" has "1 problem" and "No description: SKILL.md names none."', async () => {
    expect(skillRows(list)["release-notes"]).toBe(
      "release-notes No description: SKILL.md names none. skills/release-notes in the factory's repository · Used by the agent triage 1 problem",
    );
  });

  await then(
    'the page of "release-notes" says "factory lint: skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it"',
    async () => {
      expect(notes.getByRole("alert").text).toBe(`factory lint: ${NO_DESCRIPTION}`);
    },
  );

  await then(
    'the page of "missing" says "factory lint: the skill \\"./skills/missing\\" has no SKILL.md" and "The folder has no SKILL.md that the console can show."',
    async () => {
      expect(missing.getByRole("alert").text).toBe('factory lint: the skill "./skills/missing" has no SKILL.md');
      expect(skillMd(missing).text).toBe("SKILL.md The folder has no SKILL.md that the console can show.");
    },
  );
});
