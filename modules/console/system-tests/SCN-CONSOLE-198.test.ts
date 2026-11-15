import { type Page, scenario } from "@opensoftware/testkit";
import { servingBody, skillMd } from "./skills.ts";

const SCRIPTS = [
  "<script>alert(1)</script>",
  'Run <script src="https://evil.example/x.js"></script> now.',
  '<div onclick="alert(2)">Press</div>',
];

scenario("SCN-CONSOLE-198", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md holds a script block, a script inside a line and an element with "onclick"',
    async () => {
      await servingBody(sut, fakes, SCRIPTS.join("\n\n"));
    },
  );

  let page: Page;
  await when('a person opens "/skills/release-notes"', async () => {
    page = await sut.pages.open("/skills/release-notes");
  });

  await then('the panel "SKILL.md" shows "<script>alert(1)</script>" and the other two as text', async () => {
    expect(skillMd(page).text).toBe(`SKILL.md ${SCRIPTS.join(" ")}`);
  });

  await then("the page has no script", async () => {
    expect(page.status).toBe(200);
    expect(page.hasScript).toBe(false);
  });
});
