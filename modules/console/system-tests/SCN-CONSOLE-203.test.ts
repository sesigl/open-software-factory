import { scenario } from "@opensoftware/testkit";
import { foreman, navLinks, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-203", async ({ sut, fakes, given, when, then }) => {
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

  await then(
    'the navigation links "Runs" as the current page, "Skills" and the classic pages "Factory" and "Health"',
    async () => {
      expect(navLinks(page)).toEqual([
        { href: "/", text: "Runs" },
        { href: "/skills", text: "Skills" },
        { href: "/factory", text: "Factory" },
        { href: "/health", text: "Health" },
      ]);
      const current = page.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
      expect(current.attribute("href")).toBe("/");
    },
  );
});
