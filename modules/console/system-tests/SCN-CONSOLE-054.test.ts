import { scenario } from "@opensoftware/testkit";
import { foreman, links, NEW_RUN, open, RUN, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-054", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a foreman with the run "run_0f3c7e91a2b44d6e8c05", the attempt 2 of the run "run_5d41402abc4b2a76b971"',
    async () => {
      const run = runOf("Add a dark mode", { runId: NEW_RUN, attempt: 2, retryOf: RUN });
      await serving(sut, [(await foreman(fakes, [run])).url]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when("a person opens the run's page", async () => {
    page = await open(sut, `/runs/${NEW_RUN}`);
  });

  await then('the page names the attempt 2 and links the run before "/runs/run_5d41402abc4b2a76b971"', async () => {
    expect(page.status).toBe(200);
    expect(page.text).toContain("Attempt 2");
    expect(links(page)).toContainEqual({ href: `/runs/${RUN}`, text: RUN });
  });
});
