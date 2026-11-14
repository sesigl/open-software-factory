import { scenario } from "@opensoftware/testkit";
import { browserModule, html } from "./browser.ts";
import { testCases } from "./module.ts";

const FACTS = [
  '<main><h1>Now</h1><output></output><a href="/next">Next</a></main><script>',
  "document.querySelector('output').textContent = [new Date().toISOString(),",
  "Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language, innerWidth,",
  "matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'motion'].join(' ');",
  "</script>",
].join(" ");

scenario("SCN-TK-157", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose page "/" shows the time, the time zone, the language, the width and the reduced motion of the browser in a status, and links "Next" to a page with the heading "Next"',
    async () => {
      module = browserModule(
        html(FACTS),
        [
          'expect(await page.getByRole("status").textContent()).toBe("2026-01-01T00:00:00.000Z UTC en-US 390 reduce");',
          'await page.getByRole("link", { name: "Next" }).click();',
          'expect(await page.getByRole("heading", { level: 1 }).textContent()).toBe("Next");',
          "await sut.browser.expectAccessible(page);",
          'await sut.browser.screenshot(page, "next");',
        ],
        { "/next": html("<main><h1>Next</h1></main>") },
      );
    },
  );

  await given(
    'its system test opens "/" with sut.browser on a "phone", expects "2026-01-01T00:00:00.000Z UTC en-US 390 reduce", follows "Next", checks the page\'s accessibility and keeps the screenshot "next"',
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });

  await then('the module has the screenshot "reports/screenshots/SCN-DEMO-001/next.png"', async () => {
    const png = await sut.files.read("$INPUT/reports/screenshots/SCN-DEMO-001/next.png");
    expect(png.slice(1, 4)).toBe("PNG");
  });
});
