import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, RUN, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-019", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given('a foreman with the run "run_5d41402abc4b2a76b971"', async () => {
    api = await foreman(fakes, [runOf("Export reports as CSV")]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when(
    'a person opens the run\'s page with "CONSOLE_TEMPORAL_URL" set to "https://temporal.acme.dev"',
    async () => {
      await serving(sut, [api.url], { CONSOLE_TEMPORAL_URL: "https://temporal.acme.dev/" });
      page = await open(sut, `/runs/${RUN}`);
    },
  );

  await then(
    'the page links the history "https://temporal.acme.dev/namespaces/default/workflows/run_5d41402abc4b2a76b971"',
    async () => {
      expect(links(page.html)).toContainEqual({
        href: `https://temporal.acme.dev/namespaces/default/workflows/${RUN}`,
        text: "Temporal",
      });
    },
  );
});
