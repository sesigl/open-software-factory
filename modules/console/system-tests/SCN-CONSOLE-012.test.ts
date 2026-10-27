import { scenario } from "@opensoftware/testkit";
import { foreman, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-012", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given("a foreman with no runs", async () => {
    api = await foreman(fakes, []);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/"', async () => {
    await serving(sut, [api.url]);
    page = await open(sut, "/");
  });

  await then("the page asks the browser to reload it after 10 seconds", async () => {
    expect(page.html).toContain('<meta http-equiv="refresh" content="10"/>');
  });
});
