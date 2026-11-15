import { type Page, scenario } from "@opensoftware/testkit";
import { servingBody, skillMd } from "./skills.ts";

const RAW = [
  '<a href="https://evil.example">Sign in</a>',
  '<iframe src="https://evil.example"></iframe>',
  '<form action="https://evil.example"><input name="token"></form>',
  "<b>bold</b>",
];

scenario("SCN-CONSOLE-197", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md holds a link, a frame, a form and a bold word as raw HTML',
    async () => {
      await servingBody(sut, fakes, RAW.join("\n\n"));
    },
  );

  let page: Page;
  await when('a person opens "/skills/release-notes"', async () => {
    page = await sut.pages.open("/skills/release-notes");
  });

  await then(
    'the panel "SKILL.md" shows each as its text, like "<a href=\\"https://evil.example\\">Sign in</a>"',
    async () => {
      expect(skillMd(page).text).toBe(`SKILL.md ${RAW.join(" ")}`);
    },
  );

  await then("the panel has no link, no frame, no form and no bold word", async () => {
    const panel = skillMd(page);
    expect(panel.queryAllByRole("link")).toEqual([]);
    expect(panel.queryAllByRole("textbox")).toEqual([]);
    expect(page.forms.filter((form) => form.action.includes("evil"))).toEqual([]);
    expect(panel.queryByText("bold")).toBeUndefined();
  });
});
