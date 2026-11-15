import { scenario } from "@opensoftware/testkit";
import { factoryEnv, foreman, navLinks, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-204", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY" and "CONSOLE_IMPROVE_DIR" and the factory "acme"',
    async () => {
      await serving(sut, [(await foreman(fakes, [])).url], {
        ...(await factoryEnv(sut)),
        // The runs page asks neither intake nor the forge: their addresses only switch their pages on.
        CONSOLE_INTAKE_URL: "http://127.0.0.1:1",
        CONSOLE_INBOX_REPOSITORY: "tester/web",
        CONSOLE_IMPROVE_DIR: sut.files.path("$INPUT/improve"),
      });
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    page = await open(sut, "/");
  });

  await then(
    'the navigation links "Runs", "Skills" and the classic pages "Work", "Factory", "Inbox", "Cost and scores" and "Health"',
    async () => {
      expect(navLinks(page)).toEqual([
        { href: "/", text: "Runs" },
        { href: "/skills", text: "Skills" },
        { href: "/work", text: "Work" },
        { href: "/factory", text: "Factory" },
        { href: "/inbox", text: "Inbox" },
        { href: "/improvement", text: "Cost and scores" },
        { href: "/health", text: "Health" },
      ]);
    },
  );

  await then('the shell names the factory "acme"', async () => {
    expect(page.getByRole("banner").getByText("acme").text).toBe("acme");
  });

  await then('the page offers "Submit work" as its main action', async () => {
    expect(page.getByRole("main").getByRole("link", { name: "Submit work" }).attribute("href")).toBe("/work");
  });
});
