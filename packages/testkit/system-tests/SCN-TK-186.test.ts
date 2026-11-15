import { scenario } from "@opensoftware/testkit";
import { testCases } from "./module.ts";
import { page, siteModule } from "./site.ts";

const PATHS = ["/", "/%2e%2e%2fsecret.txt", "/leak.txt", "/missing.js"];

const TEST = [
  "let base = '';",
  "await given('the folder \"site\" is served', async () => {",
  '  base = await sut.site.serve("site");',
  "});",
  "let statuses: number[] = [];",
  "await when('the test fetches a path inside and paths outside the folder', async () => {",
  `  statuses = await Promise.all(${JSON.stringify(PATHS)}.map(async (path) => (await fetch(base + path)).status));`,
  "});",
  "await then('only the path inside answers', async () => {",
  "  expect(statuses).toEqual([200, 404, 404, 404]);",
  "});",
  "await then('sut.site serves no folder outside the unit and no file', async () => {",
  '  await expect(sut.site.serve("..")).rejects.toThrow("sut.site serves only a folder of the unit: ..");',
  '  await expect(sut.site.serve("site/index.html")).rejects.toThrow("sut.site serves only a folder of the unit: site/index.html");',
  "});",
];

scenario("SCN-TK-186", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a library with the file "secret.txt" beside its folder "site", and in "site" the page "index.html" and the link "leak.txt" to "../secret.txt"',
    async () => {
      module = siteModule(
        { "secret.txt": "the secret\n", "site/index.html": page("Site", "<main><h1>Site</h1></main>") },
        [
          'Given the folder "site" is served',
          "When the test fetches a path inside and paths outside the folder",
          "Then only the path inside answers",
          "And sut.site serves no folder outside the unit and no file",
        ],
        TEST,
      );
    },
  );

  await given(
    'its system test serves "site" with sut.site, expects "/" to answer 200 and "/%2e%2e%2fsecret.txt", "/leak.txt" and "/missing.js" to answer 404, and expects sut.site to refuse to serve ".." and "site/index.html"',
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
      await sut.files.link("$INPUT/site/leak.txt", "../secret.txt");
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
