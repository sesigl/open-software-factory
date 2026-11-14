import { scenario } from "@opensoftware/testkit";
import { text } from "@opensoftware/ui";

const ICON = "M4 27V15l8-6v6l8-6v6l8-6v18H4zM14 27v-5h4v5h-4z";

scenario("SCN-UI-002", async ({ given, when, then }) => {
  let names: Parameters<typeof text>[0][] = [];
  await given('the files of "@opensoftware/ui"', async () => {
    names = ["icon", "wordmark", "favicon"];
  });

  let svgs: string[] = [];
  await when("a page reads the icon, the wordmark and the favicon", async () => {
    svgs = names.map((name) => text(name));
  });

  await then(
    'each is an SVG with the path "M4 27V15l8-6v6l8-6v6l8-6v18H4zM14 27v-5h4v5h-4z" filled with the even-odd rule',
    async () => {
      for (const svg of svgs) {
        expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        expect(svg).toContain(`fill-rule="evenodd" d="${ICON}"`);
      }
      expect(svgs[2]).toContain('fill="#ff6b1a"');
    },
  );

  await then(
    'the icon and the wordmark are named "Open Software Factory" and take the colour of the text around them',
    async () => {
      expect(svgs[0]).toContain('role="img" aria-label="Open Software Factory"><path fill="currentColor"');
      expect(svgs[1]).toContain('role="img" aria-label="Open Software Factory"><path fill="currentColor"');
    },
  );
});
