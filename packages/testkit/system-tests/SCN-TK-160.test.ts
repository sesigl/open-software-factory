import { scenario } from "@opensoftware/testkit";
import { browserModule, html } from "./browser.ts";

scenario("SCN-TK-160", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose page "/" has a button without a name', async () => {
    module = browserModule(html("<main><h1>Form</h1><button></button></main>"), [
      "await sut.browser.expectAccessible(page);",
    ]);
  });

  await given('its system test opens "/" with sut.browser and checks the page\'s accessibility', async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "button-name"', async () => {
    expect(run.stdout + run.stderr).toContain("button-name");
  });
});
