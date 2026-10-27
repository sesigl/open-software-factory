import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-009", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given("a foreman with no runs", async () => {
    api = await foreman(fakes, []);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    await serving(sut, [api.url]);
    page = await open(sut, "/");
  });

  await then(
    'the page links "?state=running", "?state=blocked", "?state=complete", "?state=failed" and "?state=cancelled"',
    async () => {
      expect(links(page.html).filter((link) => link.href.startsWith("?state="))).toEqual(
        ["running", "blocked", "complete", "failed", "cancelled"].map((state) => ({
          href: `?state=${state}`,
          text: state,
        })),
      );
      expect(page.html).toContain('<a href="/" aria-current="page">all</a>');
    },
  );
});
