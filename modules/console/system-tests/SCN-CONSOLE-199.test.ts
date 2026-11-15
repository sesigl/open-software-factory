import { type Page, scenario } from "@opensoftware/testkit";
import { servingBody, skillMd } from "./skills.ts";

scenario("SCN-CONSOLE-199", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md holds the image "![Team chart](https://cdn.example/chart.png)", a data image and an image as raw HTML',
    async () => {
      const images = [
        "![Team chart](https://cdn.example/chart.png)",
        "![Dot](data:image/png;base64,iVBORw0KGgo=)",
        '<img src="https://cdn.example/track.png" alt="Track">',
      ];
      await servingBody(sut, fakes, images.join("\n\n"));
    },
  );

  let page: Page;
  await when('a person opens "/skills/release-notes"', async () => {
    page = await sut.pages.open("/skills/release-notes");
  });

  await then('the panel "SKILL.md" has no image', async () => {
    expect(skillMd(page).queryAllByRole("img")).toEqual([]);
    expect(skillMd(page).queryAllByRole("presentation")).toEqual([]);
  });

  await then('it shows "Team chart" in place of the first', async () => {
    expect(skillMd(page).text).toBe('SKILL.md Team chart Dot <img src="https://cdn.example/track.png" alt="Track">');
  });
});
