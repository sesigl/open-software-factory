import { scenario } from "@opensoftware/testkit";
import { opensPage } from "./affected.ts";
import { DEMO_TEST, demoModule, systemTest } from "./repo.ts";

scenario("SCN-REPO-140", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(`$INPUT/${path}`, content);
  });

  await given('the test clicks the element "button.primary" of a page that sut.browser opened', async () => {
    const assertion = [opensPage, 'await page.locator("button.primary").click();', "expect(run.exitCode).toBe(0);"];
    await sut.files.put(`$INPUT/${DEMO_TEST}`, systemTest({ assertion: assertion.join("\n    ") }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check UI-QUERY"', async () => {
    run = await sut.cli(["check", "UI-QUERY"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "UI-QUERY modules/demo/system-tests/SCN-DEMO-001.test.ts:12 locator finds or waits by something other than role, label or text"',
    async () => {
      expect(run.stdout).toContain(
        "UI-QUERY modules/demo/system-tests/SCN-DEMO-001.test.ts:12 locator finds or waits by something other than role, label or text",
      );
    },
  );
});
