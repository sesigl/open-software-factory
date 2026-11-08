import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, RUN, runOf, serving } from "./console.ts";

const TRACE = "0af7651916cd43dd8448eb211c80319c";
const TEMPLATE = "http://127.0.0.1:6006/projects/UHJvamVjdDox/traces/{traceId}";

scenario("SCN-CONSOLE-041", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given('a foreman with a run whose trace ID is "0af7651916cd43dd8448eb211c80319c"', async () => {
    api = await foreman(fakes, [runOf("Export reports as CSV", { traceId: TRACE })]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when(
    'a person opens the run\'s page with "CONSOLE_TRACE_URL" set to "http://127.0.0.1:6006/projects/UHJvamVjdDox/traces/{traceId}"',
    async () => {
      await serving(sut, [api.url], { CONSOLE_TRACE_URL: TEMPLATE });
      page = await open(sut, `/runs/${RUN}`);
    },
  );

  await then(
    'the page links the trace "http://127.0.0.1:6006/projects/UHJvamVjdDox/traces/0af7651916cd43dd8448eb211c80319c"',
    async () => {
      expect(links(page.html)).toContainEqual({ href: TEMPLATE.replace("{traceId}", TRACE), text: "trace" });
    },
  );
});
