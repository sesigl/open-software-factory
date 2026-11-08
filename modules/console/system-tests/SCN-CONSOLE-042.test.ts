import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, RUN, runOf, serving } from "./console.ts";

const TEMPLATE = "http://127.0.0.1:6006/projects/UHJvamVjdDox/traces/{traceId}";

scenario("SCN-CONSOLE-042", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given("a foreman with a run without a trace ID", async () => {
    api = await foreman(fakes, [runOf("Export reports as CSV")]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when(`a person opens the run's page with "CONSOLE_TRACE_URL" set to "${TEMPLATE}"`, async () => {
    await serving(sut, [api.url], { CONSOLE_TRACE_URL: TEMPLATE });
    page = await open(sut, `/runs/${RUN}`);
  });

  await then('the page has no link with the text "trace"', async () => {
    expect(page.status).toBe(200);
    expect(links(page.html).filter(({ text }) => text === "trace")).toEqual([]);
  });
});
