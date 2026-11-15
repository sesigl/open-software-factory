import { scenario } from "@opensoftware/testkit";
import { testCases } from "./module.ts";
import { POLICY, page, siteModule } from "./site.ts";

const FILES = {
  "site/index.html": page("Site", "<main><h1>Site</h1></main>"),
  "site/app.js": 'console.log("app");\n',
  "site/style.css": "main { margin: 0; }\n",
  "site/data.json": '{"runs":2}\n',
  "site/icon.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n',
  "site/notes.bin": "notes\n",
};

const SERVED = [
  ["/", FILES["site/index.html"], "text/html; charset=utf-8"],
  ["/app.js", FILES["site/app.js"], "text/javascript; charset=utf-8"],
  ["/style.css", FILES["site/style.css"], "text/css; charset=utf-8"],
  ["/data.json", FILES["site/data.json"], "application/json"],
  ["/icon.svg", FILES["site/icon.svg"], "image/svg+xml"],
  ["/notes.bin", FILES["site/notes.bin"], "application/octet-stream"],
];

const TEST = [
  "let base = '';",
  "await given('the folder \"site\" is served', async () => {",
  `  base = await sut.site.serve("site", { headers: { "Content-Security-Policy": "${POLICY}" } });`,
  "});",
  "let answers: { text: string; type: string | null; policy: string | null }[] = [];",
  "await when('the test fetches each file', async () => {",
  `  answers = await Promise.all(${JSON.stringify(SERVED.map(([path]) => path))}.map(async (path) => {`,
  "    const answer = await fetch(base + path);",
  '    return { text: await answer.text(), type: answer.headers.get("content-type"), policy: answer.headers.get("content-security-policy") };',
  "  }));",
  "});",
  "await then('each file has its text, its content type and the header', async () => {",
  `  expect(answers).toEqual(${JSON.stringify(SERVED.map(([, text, type]) => ({ text, type, policy: POLICY })))});`,
  "  expect(sut.site.url()).toBe(base);",
  "});",
];

scenario("SCN-TK-185", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a library whose folder "site" holds "index.html", "app.js", "style.css", "data.json", "icon.svg" and "notes.bin"',
    async () => {
      module = siteModule(
        FILES,
        [
          'Given the folder "site" is served',
          "When the test fetches each file",
          "Then each file has its text, its content type and the header",
        ],
        TEST,
      );
    },
  );

  await given(
    `its system test serves "site" with sut.site and the header "Content-Security-Policy: script-src 'self'", fetches "/", "/app.js", "/style.css", "/data.json", "/icon.svg" and "/notes.bin", and expects each file's text, its content type and the header`,
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
