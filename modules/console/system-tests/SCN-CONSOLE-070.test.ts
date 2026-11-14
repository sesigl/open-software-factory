import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, RUN, runOf, serving } from "./console.ts";

const TRACE = "0af7651916cd43dd8448eb211c80319c";
const SPAN = "b7ad6b7169203331";

scenario("SCN-CONSOLE-070", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given(
    'a foreman with a run whose trace ID is "0af7651916cd43dd8448eb211c80319c" and whose stage "plan" has the span "b7ad6b7169203331"',
    async () => {
      api = await foreman(fakes, [
        runOf("Export reports as CSV", {
          traceId: TRACE,
          stages: [
            { stage: "plan", agent: "planner", state: "running", spanId: SPAN },
            { stage: "implement", agent: "coder", state: "pending" },
          ],
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

  await then(
    'the page links the span "http://127.0.0.1:16686/trace/0af7651916cd43dd8448eb211c80319c?uiFind=b7ad6b7169203331" of the stage "plan"',
    async () => {
      const spans = links(page).filter(({ href }) => href.startsWith("http://127.0.0.1:16686/"));
      expect(spans).toEqual([{ href: `http://127.0.0.1:16686/trace/${TRACE}?uiFind=${SPAN}`, text: "plan" }]);
    },
  );
});
