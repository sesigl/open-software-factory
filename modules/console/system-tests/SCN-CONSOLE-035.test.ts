import { scenario } from "@opensoftware/testkit";
import { foreman, navLinks, open, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-035", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given('a console without "CONSOLE_INBOX_REPOSITORY"', async () => {
    api = await foreman(fakes, []);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/inbox"', async () => {
    await serving(sut, [api.url]);
    page = await open(sut, "/inbox");
  });

  await then(
    'the page answers 404 and says "no inbox: set CONSOLE_INBOX_REPOSITORY to the repository of observer\'s pull requests"',
    async () => {
      expect(page.status).toBe(404);
      expect(text(page.html)).toContain(
        "no inbox: set CONSOLE_INBOX_REPOSITORY to the repository of observer's pull requests",
      );
    },
  );

  await then('the page\'s navigation does not link "/inbox"', async () => {
    expect(navLinks(page.html).map((link) => link.href)).toEqual(["/", "/factory"]);
  });
});
