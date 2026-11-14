import { scenario } from "@opensoftware/testkit";
import { browserModule, html } from "./browser.ts";

scenario("SCN-TK-158", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose page "/" loads the image "https://example.com/logo.png"', async () => {
    module = browserModule(html('<main><h1>Logo</h1><img alt="Logo" src="https://example.com/logo.png"></main>'), []);
  });

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

  await then(
    'the output contains "the browser refused a request that leaves loopback: https://example.com/logo.png"',
    async () => {
      expect(run.stdout + run.stderr).toContain(
        "the browser refused a request that leaves loopback: https://example.com/logo.png",
      );
    },
  );
});
