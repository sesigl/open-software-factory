import { type Page, scenario } from "@opensoftware/testkit";
import { factoryEnv, foreman, links, open, serving } from "./console.ts";

/** The pages of the problems, in the order the scenario opens them. */
const PATHS = [
  "/?state=merged",
  "/improvement",
  "/factory/agents/deploy",
  "/secrets",
  "/skills/release-notes/switch?agent=triage",
];

scenario("SCN-CONSOLE-260", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console without "CONSOLE_IMPROVE_DIR", a sign-in, a secret store and a factory repository',
    async () => {
      await serving(sut, [(await foreman(fakes, [])).url], await factoryEnv(sut));
    },
  );

  let pages: Page[] = [];
  await when(
    'a person opens "/?state=merged", "/improvement", "/factory/agents/deploy", "/secrets" and "/skills/release-notes/switch?agent=triage", and a program sends the form "Propose change"',
    async () => {
      pages = [
        ...(await Promise.all(PATHS.map((path) => open(sut, path)))),
        await sut.pages.send("/changes", { edit: "add-egress", agent: "triage", value: "api.linear.app" }),
      ];
    },
  );

  await then(
    "the pages answer 400, 404, 404, 404, 404 and 404 in the shell, each with its title as the heading",
    async () => {
      expect(pages.map((page) => page.status)).toEqual([400, 404, 404, 404, 404, 404]);
      for (const page of pages) {
        const heading = page.getByRole("main").getByRole("heading", { level: 1 }).text;
        expect([page.getAllByRole("navigation", { name: "Main" }).length, page.title]).toEqual([
          1,
          `${heading} · Open Software Factory`,
        ]);
      }
      expect(pages.map((page) => page.getByRole("heading", { level: 1 }).text)).toEqual([
        "No such state",
        "No cost and scores",
        "Not found",
        "No secrets",
        "No changes",
        "No changes",
      ]);
    },
  );

  await then(
    '"/factory/agents/deploy" leads back to "Factory" at "/factory", the switch to "Skills" at "/skills", and the others to "Runs" at "/"',
    async () => {
      // The way back is the first link of the content, above the title; the navigation marks the same page.
      expect(pages.map((page) => links(page.getByRole("main"))[0])).toEqual([
        { href: "/", text: "Runs" },
        { href: "/", text: "Runs" },
        { href: "/factory", text: "Factory" },
        { href: "/", text: "Runs" },
        { href: "/skills", text: "Skills" },
        { href: "/", text: "Runs" },
      ]);
      const current = pages.map((page) =>
        page.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" }).attribute("href"),
      );
      expect(current).toEqual(["/", "/", "/factory", "/", "/skills", "/"]);
    },
  );
});
