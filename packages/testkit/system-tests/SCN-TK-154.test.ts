import { scenario } from "@opensoftware/testkit";
import { pageModule, testCases } from "./module.ts";

const RUNS = [
  '<!doctype html><html lang="en"><head><title>Runs</title>',
  '<meta http-equiv="refresh" content="10"><link rel="stylesheet" href="/site.css"></head>',
  "<body><main><h1>Runs</h1><table><thead><tr><th>Title</th><th>State</th></tr></thead>",
  '<tbody><tr><td><a href="/runs/1">Export</a></td><td>running</td></tr></tbody></table></main></body></html>',
].join("");

scenario("SCN-TK-154", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose server answers "GET /" with the page "Runs": a heading, the link "Export" to "/runs/1" in a table row with "running", the stylesheet "/site.css" and a reload after 10 seconds',
    async () => {
      module = pageModule(
        { "/": RUNS },
        [],
        ['When the user opens "/"', 'Then the page lists the run "Export"'],
        [
          "await sut.http.start();",
          "let page: Awaited<ReturnType<typeof sut.pages.open>>;",
          "await when('the user opens \"/\"', async () => {",
          '  page = await sut.pages.open("/");',
          "});",
          "await then('the page lists the run \"Export\"', async () => {",
          "  expect(page.status).toBe(200);",
          '  expect(page.title).toBe("Runs");',
          '  expect(page.getByRole("heading", { level: 1 }).text).toBe("Runs");',
          '  expect(page.getByRole("link", { name: "Export" }).attribute("href")).toBe("/runs/1");',
          '  const row = page.getAllByRole("row")[1];',
          '  expect(row?.getAllByRole("cell").map((cell) => cell.text)).toEqual(["Export", "running"]);',
          '  expect(page.getByText("running").name).toBe("running");',
          '  expect(page.stylesheets).toEqual(["/site.css"]);',
          "  expect(page.refresh).toBe(10);",
          "  expect(page.hasScript).toBe(false);",
          '  expect(page.text).toBe("Runs Title State Export running");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test opens "/" with sut.pages and expects that title, heading, link, row, stylesheet and reload, and no script',
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
