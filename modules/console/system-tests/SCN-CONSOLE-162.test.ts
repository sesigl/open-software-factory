import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-162", async ({ sut, fakes, given, when, then }) => {
  await given("a foreman with no runs", async () => {
    await serving(sut, [(await foreman(fakes, [])).url]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    page = await open(sut, "/");
  });

  await then('the page\'s first link is "Skip to the content", to "#content"', async () => {
    expect(links(page)[0]).toEqual({ href: "#content", text: "Skip to the content" });
  });

  await then(
    'the page has the banner, the navigation "Main", the region "Account" and the main content "#content"',
    async () => {
      expect(page.getAllByRole("banner")).toHaveLength(1);
      expect(page.getByRole("navigation", { name: "Main" }).name).toBe("Main");
      expect(page.getByRole("region", { name: "Account" }).name).toBe("Account");
      expect(page.getByRole("main").attribute("id")).toBe("content");
    },
  );
});
