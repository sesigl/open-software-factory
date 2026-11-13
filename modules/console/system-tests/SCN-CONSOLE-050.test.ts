import { scenario } from "@opensoftware/testkit";
import { ADA, foreman, NEW_RUN, openWith, RUN, retryForm, runOf, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-050", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman with a run whose stage "implement" failed and a cancelled run',
    async () => {
      const failed = runOf("Add a dark mode", {
        state: "failed",
        stages: [{ stage: "implement", agent: "implement", state: "failed", reason: "the tests failed" }],
      });
      const cancelled = runOf("Fix the login", { runId: NEW_RUN, state: "cancelled" });
      url = await serving(sut, [(await foreman(fakes, [failed, cancelled])).url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
      });
    },
  );

  let pages: Awaited<ReturnType<typeof openWith>>[] = [];
  await when('the person "ada@acme.dev" opens the page of each run', async () => {
    pages = [await openWith(url, `/runs/${RUN}`, ADA), await openWith(url, `/runs/${NEW_RUN}`, ADA)];
  });

  await then('both pages have the form "run again"', async () => {
    expect(pages.map(({ status }) => status)).toEqual([200, 200]);
    for (const [index, runId] of [RUN, NEW_RUN].entries()) {
      const form = retryForm(pages[index]?.html ?? "") ?? "";
      expect(form).toContain(`action="/runs/${runId}/retry"`);
      expect(form).toContain('method="post"');
      expect(text(form)).toBe("Run again");
    }
  });
});
