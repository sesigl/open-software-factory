import { scenario } from "@opensoftware/testkit";
import { foreman, open, rows, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-014", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given('a foreman with the run "<script>alert(1)</script>"', async () => {
    api = await foreman(fakes, [runOf("<script>alert(1)</script>")]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    await serving(sut, [api.url]);
    page = await open(sut, "/");
  });

  await then('the page shows the text "<script>alert(1)</script>"', async () => {
    expect(rows(page.html)[0]?.[0]).toBe("<script>alert(1)</script>");
  });

  await then("the page has no script element", async () => {
    expect(page.html).not.toMatch(/<script/i);
  });
});
