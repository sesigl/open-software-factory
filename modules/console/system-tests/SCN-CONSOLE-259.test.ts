import { scenario } from "@opensoftware/testkit";
import { factoryEnv, foreman, links, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-259", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY", "CONSOLE_IMPROVE_DIR", the factory "acme" and the dashboard "Grafana" at "https://grafana.acme.dev"',
    async () => {
      await serving(sut, [(await foreman(fakes, [])).url], {
        ...(await factoryEnv(sut)),
        // The runs page asks neither intake nor the forge: their addresses only switch their pages on.
        CONSOLE_INTAKE_URL: "http://127.0.0.1:1",
        CONSOLE_INBOX_REPOSITORY: "tester/web",
        CONSOLE_IMPROVE_DIR: sut.files.path("$INPUT/improve"),
        CONSOLE_LINKS: "Grafana=https://grafana.acme.dev",
      });
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    page = await open(sut, "/");
  });

  await then(
    'the navigation links "Runs", "Work", "Inbox", "Skills", "Factory", "Cost and scores" and "Health" in one list, and "Grafana" in a list below it',
    async () => {
      const lists = page.getByRole("navigation", { name: "Main" }).queryAllByRole("list");
      expect(lists.map((list) => links(list))).toEqual([
        [
          { href: "/", text: "Runs" },
          { href: "/work", text: "Work" },
          { href: "/inbox", text: "Inbox" },
          { href: "/skills", text: "Skills" },
          { href: "/factory", text: "Factory" },
          { href: "/improvement", text: "Cost and scores" },
          { href: "/health", text: "Health" },
        ],
        [{ href: "https://grafana.acme.dev", text: "Grafana" }],
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
