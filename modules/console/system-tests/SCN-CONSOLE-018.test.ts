import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, RUN, rows, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-018", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given('a foreman with a run whose stage "plan" has the session "sess-plan"', async () => {
    api = await foreman(fakes, [
      runOf("Export reports as CSV", {
        stages: [{ stage: "plan", agent: "planner", state: "running", sessionId: "sess-plan" }],
      }),
    ]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when(
    'a person opens the run\'s page with "CONSOLE_TRACE_URL" set to "https://langfuse.acme.dev/traces?run={runId}" and "CONSOLE_SESSION_URL" set to "https://langfuse.acme.dev/sessions/{sessionId}"',
    async () => {
      await serving(sut, [api.url], {
        CONSOLE_TRACE_URL: "https://langfuse.acme.dev/traces?run={runId}",
        CONSOLE_SESSION_URL: "https://langfuse.acme.dev/sessions/{sessionId}",
      });
      page = await open(sut, `/runs/${RUN}`);
    },
  );

  await then('the page links the trace "https://langfuse.acme.dev/traces?run=run_5d41402abc4b2a76b971"', async () => {
    expect(links(page.html)).toContainEqual({ href: `https://langfuse.acme.dev/traces?run=${RUN}`, text: "trace" });
  });

  await then(
    'the page links the transcript "https://langfuse.acme.dev/sessions/sess-plan" of the stage "plan"',
    async () => {
      expect(rows(page.html)[0]?.[3]).toBe("sess-plan");
      expect(links(page.html)).toContainEqual({
        href: "https://langfuse.acme.dev/sessions/sess-plan",
        text: "sess-plan",
      });
    },
  );
});
