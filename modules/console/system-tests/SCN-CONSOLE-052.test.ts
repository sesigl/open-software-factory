import { scenario } from "@opensoftware/testkit";
import { ADA, buttons, foreman, NEW_RUN, openWith, RUN, retryForm, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-052", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman with a running run and a complete run',
    async () => {
      const runs = [runOf("Add a dark mode"), runOf("Fix the login", { runId: NEW_RUN, state: "complete" })];
      url = await serving(sut, [(await foreman(fakes, runs)).url], { CONSOLE_USER_HEADER: "X-Forwarded-Email" });
    },
  );

  let pages: Awaited<ReturnType<typeof openWith>>[] = [];
  await when('the person "ada@acme.dev" opens the page of each run', async () => {
    pages = [await openWith(url, `/runs/${RUN}`, ADA), await openWith(url, `/runs/${NEW_RUN}`, ADA)];
  });

  await then('neither page has the form "run again"', async () => {
    expect(pages.map(({ status }) => status)).toEqual([200, 200]);
    expect(pages.map(({ html }) => retryForm(html))).toEqual([undefined, undefined]);
    // The running run has the forms that signal it (ADR 0118), the complete run none.
    expect(pages.map(({ html }) => buttons(html))).toEqual([["Steer", "Cancel"], []]);
  });
});
