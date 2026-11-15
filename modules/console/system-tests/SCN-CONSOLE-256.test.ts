import { scenario } from "@opensoftware/testkit";
import { open, proposalForge, rows, servingInbox } from "./console.ts";

scenario("SCN-CONSOLE-256", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof proposalForge>>;
  await given('the forge\'s repository "tester/web" without open pull requests', async () => {
    box = await proposalForge(fakes, []);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/inbox"', async () => {
    await servingInbox(sut, fakes, box.forge);
    page = await open(sut, "/inbox");
  });

  await then(
    'the page has the title "Inbox", the navigation "Main" with "Inbox" as the current page, and does not link "/pico.css"',
    async () => {
      expect([page.status, page.title]).toEqual([200, "Inbox · Open Software Factory"]);
      expect(page.getByRole("heading", { level: 1 }).text).toBe("Inbox");
      const current = page.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
      expect([current.text, current.attribute("href")]).toEqual(["Inbox", "/inbox"]);
      expect(page.stylesheets.filter((href) => href === "/pico.css")).toEqual([]);
      expect(page.stylesheets.some((href) => href.startsWith("/_astro/"))).toBe(true);
    },
  );

  await then('the page says "No open proposals." and names the repository "tester/web"', async () => {
    expect(rows(page)).toEqual([]);
    const main = page.getByRole("main").text;
    expect(main).toContain("The open proposals in tester/web.");
    expect(main).toContain("No open proposals.");
  });
});
