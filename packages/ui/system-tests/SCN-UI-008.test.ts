import { scenario } from "@opensoftware/testkit";
import { serveWorkbench } from "./workbench.ts";

const PAGES = [
  "/work-list/rows/",
  "/work-list/empty/",
  "/work-list/failing/",
  "/work-list/signed-out/",
  "/work-list/off/",
];

/** Each `<script ...>...</script>` of a page: its attributes and its content. */
const scripts = (html: string) =>
  [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(([, attributes, content]) => ({
    attributes: attributes?.trim(),
    content,
  }));

scenario("SCN-UI-008", async ({ sut, given, when, then }) => {
  await given("the workbench is served with the console's Content-Security-Policy", async () => {
    await serveWorkbench(sut);
  });

  let pages: string[] = [];
  await when(
    'a person loads each of its pages "/work-list/rows/", "/work-list/empty/", "/work-list/failing/", "/work-list/signed-out/" and "/work-list/off/"',
    async () => {
      pages = await Promise.all(PAGES.map(async (path) => (await fetch(new URL(path, sut.site.url()))).text()));
    },
  );

  await then(
    'each page has one script, a module script of the site\'s own "/_astro/" folder, and no inline script',
    async () => {
      expect(pages.map(scripts)).toEqual(
        PAGES.map(() => [
          { attributes: expect.stringMatching(/^type="module" src="\/_astro\/[\w.-]+\.js"$/), content: "" },
        ]),
      );
      expect(pages.map((html) => html.includes("<script>"))).toEqual(PAGES.map(() => false));
    },
  );
});
