import { scenario } from "@opensoftware/testkit";
import { ADA, foreman, NEW_RUN, open, RUN, retryButton, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-050", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman with a run whose stage "implement" failed and a cancelled run',
    async () => {
      const failed = runOf("Add a dark mode", {
        state: "failed",
        stages: [{ stage: "implement", agent: "implement", state: "failed", reason: "the tests failed" }],
      });
      const cancelled = runOf("Fix the login", { runId: NEW_RUN, state: "cancelled" });
      await serving(sut, [(await foreman(fakes, [failed, cancelled])).url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
      });
    },
  );

  let pages: Awaited<ReturnType<typeof open>>[] = [];
  await when('the person "ada@acme.dev" opens the page of each run', async () => {
    pages = [await open(sut, `/runs/${RUN}`, ADA), await open(sut, `/runs/${NEW_RUN}`, ADA)];
  });

  await then('both pages have the form "run again"', async () => {
    expect(pages.map(({ status }) => status)).toEqual([200, 200]);
    for (const [index, runId] of [RUN, NEW_RUN].entries()) {
      const page = pages[index];
      expect(page?.forms).toContainEqual({ name: "", method: "post", action: `/runs/${runId}/retry` });
      expect(page && retryButton(page)?.name).toBe("Run again");
    }
  });
});
