import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, RUN, runOf, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-029", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given('a foreman with a run whose origin is "javascript:alert(1)"', async () => {
    const run = runOf("Export reports as CSV");
    run.workItem.origin = { source: "slack", url: "javascript:alert(1)" };
    api = await foreman(fakes, [run]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when("a person opens the run's page", async () => {
    await serving(sut, [api.url]);
    page = await open(sut, `/runs/${RUN}`);
  });

  await then('the page shows "slack asked by Varun" without a link to "javascript:alert(1)"', async () => {
    expect(text(page.html)).toContain("Origin slack asked by Varun Evidence");
    expect(links(page.html).map((link) => link.href)).not.toContain("javascript:alert(1)");
    expect(page.html).not.toContain("javascript:");
  });
});
