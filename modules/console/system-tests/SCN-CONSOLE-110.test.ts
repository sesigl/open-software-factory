import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, RUN, runOf, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-110", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given(
    'a foreman with a run without a trace ID whose stage "plan" has the span "b7ad6b7169203331"',
    async () => {
      api = await foreman(fakes, [
        runOf("Export reports as CSV", {
          stages: [{ stage: "plan", agent: "planner", state: "running", spanId: "b7ad6b7169203331" }],
        }),
      ]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when(
    'a person opens the run\'s page with "CONSOLE_SPAN_URL" set to "http://127.0.0.1:16686/trace/{traceId}?uiFind={spanId}"',
    async () => {
      await serving(sut, [api.url], { CONSOLE_SPAN_URL: "http://127.0.0.1:16686/trace/{traceId}?uiFind={spanId}" });
      page = await open(sut, `/runs/${RUN}`);
    },
  );

  await then('the page has no link to "http://127.0.0.1:16686/" and names the stage "plan"', async () => {
    expect(page.status).toBe(200);
    expect(links(page.html).filter(({ href }) => href.startsWith("http://127.0.0.1:16686/"))).toEqual([]);
    expect(text(page.html)).toContain("plan planner running");
  });
});
