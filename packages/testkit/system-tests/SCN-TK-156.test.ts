import { scenario } from "@opensoftware/testkit";
import { pageModule } from "./module.ts";

scenario("SCN-TK-156", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose server answers "GET /" with a page without a link', async () => {
    module = pageModule(
      { "/": '<!doctype html><html lang="en"><title>Runs</title><main><h1>Runs</h1></main></html>' },
      [],
      ['When the user opens "/"', 'Then the page has the link "Export"'],
      [
        "await sut.http.start();",
        "let page: Awaited<ReturnType<typeof sut.pages.open>>;",
        "await when('the user opens \"/\"', async () => {",
        '  page = await sut.pages.open("/");',
        "});",
        "await then('the page has the link \"Export\"', async () => {",
        '  page.getByRole("link", { name: "Export" });',
        "});",
      ],
    );
  });

  await given('its system test expects the link "Export" on "/" with sut.pages', async () => {
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
    'the output contains \'Unable to find an accessible element with the role "link" and name "Export"\'',
    async () => {
      expect(run.stdout + run.stderr).toContain(
        'Unable to find an accessible element with the role "link" and name "Export"',
      );
    },
  );
});
