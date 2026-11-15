import { type Page, scenario } from "@opensoftware/testkit";
import { factoryEnv, links, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-263", async ({ sut, given, when, then }) => {
  await given('"CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage"', async () => {
    await serving(sut, ["http://127.0.0.1:1"], await factoryEnv(sut));
  });

  let pages: Page[] = [];
  await when('a person opens "/factory" and "/factory/agents/triage"', async () => {
    pages = [await open(sut, "/factory"), await open(sut, "/factory/agents/triage")];
  });

  await then(
    'both pages have the title of their heading, "acme" and "triage", and mark "Factory" as the current page',
    async () => {
      expect(pages.map((page) => [page.status, page.getByRole("heading", { level: 1 }).text, page.title])).toEqual([
        [200, "acme", "Factory · Open Software Factory"],
        [200, "triage", "triage · Open Software Factory"],
      ]);
      for (const page of pages) {
        const current = page.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
        expect([current.attribute("href"), current.text]).toEqual(["/factory", "Factory"]);
      }
    },
  );

  await then('the agent\'s page leads back to "Factory" at "/factory" above its heading', async () => {
    const main = (pages[1] as Page).getByRole("main");
    expect(links(main)[0]).toEqual({ href: "/factory", text: "Factory" });
    expect(main.text.indexOf("Factory / triage")).toBeLessThan(main.text.indexOf("Read-only."));
  });
});
