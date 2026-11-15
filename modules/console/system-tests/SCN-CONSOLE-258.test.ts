import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-258", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console without "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY" and "CONSOLE_IMPROVE_DIR"',
    async () => {
      await serving(sut, [(await foreman(fakes, [])).url]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    page = await open(sut, "/");
  });

  const navigation = () => page.getByRole("navigation", { name: "Main" });

  await then(
    'the navigation links "Runs" as the current page, "Skills", "Factory" and "Health" in one list',
    async () => {
      // The second list holds the dashboards, and this console has none.
      expect(
        navigation()
          .queryAllByRole("list")
          .map((list) => links(list)),
      ).toEqual([
        [
          { href: "/", text: "Runs" },
          { href: "/skills", text: "Skills" },
          { href: "/factory", text: "Factory" },
          { href: "/health", text: "Health" },
        ],
        [],
      ]);
      expect(navigation().getByRole("link", { current: "page" }).attribute("href")).toBe("/");
    },
  );

  await then('the navigation has no group "Classic pages"', async () => {
    expect(navigation().text).not.toContain("Classic pages");
  });
});
