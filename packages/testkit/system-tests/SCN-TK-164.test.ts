import { scenario } from "@opensoftware/testkit";
import { pageModule, testCases } from "./module.ts";

scenario("SCN-TK-164", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose page "/" has the theme "light" on its root element and whose page "/plain" has none',
    async () => {
      module = pageModule(
        {
          "/": '<!doctype html><html lang="en" data-theme="light"><head><title>Runs</title></head><body></body></html>',
          "/plain": '<!doctype html><html lang="en"><head><title>Plain</title></head><body></body></html>',
        },
        [],
        ['When the user opens "/" and "/plain"', 'Then the first page has the theme "light" and the second none'],
        [
          "await sut.http.start();",
          "let pages: Awaited<ReturnType<typeof sut.pages.open>>[] = [];",
          'await when(\'the user opens "/" and "/plain"\', async () => {',
          '  pages = [await sut.pages.open("/"), await sut.pages.open("/plain")];',
          "});",
          "await then('the first page has the theme \"light\" and the second none', async () => {",
          '  expect(pages.map((page) => page.theme)).toEqual(["light", undefined]);',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test opens both pages with sut.pages and expects the theme "light" and no theme',
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
});
