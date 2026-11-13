import { scenario } from "@opensoftware/testkit";
import { ADA, foreman, openWith, RUN, retryForm, runOf, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-050", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman with a run whose stage "implement" failed',
    async () => {
      const run = runOf("Add a dark mode", {
        state: "failed",
        stages: [{ stage: "implement", agent: "implement", state: "failed", reason: "the tests failed" }],
      });
      url = await serving(sut, [(await foreman(fakes, [run])).url], { CONSOLE_USER_HEADER: "X-Forwarded-Email" });
    },
  );

  let page: Awaited<ReturnType<typeof openWith>>;
  await when('the person "ada@acme.dev" opens the run\'s page', async () => {
    page = await openWith(url, `/runs/${RUN}`, ADA);
  });

  await then('the page has the form "run again"', async () => {
    expect(page.status).toBe(200);
    const form = retryForm(page.html) ?? "";
    expect(form).toContain(`action="/runs/${RUN}/retry"`);
    expect(form).toContain('method="post"');
    expect(text(form)).toBe("Run again");
  });
});
