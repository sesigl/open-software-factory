import { scenario } from "@opensoftware/testkit";
import { browserModule, html } from "./browser.ts";

scenario("SCN-TK-159", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose page "/" writes the error "the chart has no data" to the browser\'s console',
    async () => {
      module = browserModule(
        html('<main><h1>Chart</h1></main><script>console.error("the chart has no data")</script>'),
        [],
      );
    },
  );

  await given('its system test opens "/" with sut.browser', async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "an error in the browser\'s console: the chart has no data"', async () => {
    expect(run.stdout + run.stderr).toContain("an error in the browser's console: the chart has no data");
  });
});
