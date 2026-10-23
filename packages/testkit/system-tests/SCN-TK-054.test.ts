import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-054", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose server answers "GET /greeting" with the JSON text of "DEMO_GREETING"', async () => {
    module = demoModule({
      bin: [
        'import { createServer } from "node:http";',
        "createServer((request, response) => {",
        '  response.writeHead(200, { "content-type": "application/json" });',
        "  response.end(JSON.stringify({ text: process.env.DEMO_GREETING }));",
        '}).listen(Number(process.env.PORT), "127.0.0.1");',
        "",
      ].join("\n"),
      readme: [
        "# demo",
        "",
        "## Configuration",
        "",
        "| Variable | Meaning |",
        "| --- | --- |",
        "| `PORT` | Port the server listens on. |",
        "| `DEMO_GREETING` | The greeting. |",
        "",
      ].join("\n"),
      steps: ['When the user restarts the server with the greeting "hi"', 'Then the greeting is "hi"'],
      test: [
        'await sut.http.start([], { env: { DEMO_GREETING: "hello" } });',
        'const before = await sut.http.get("/greeting");',
        "await when('the user restarts the server with the greeting \"hi\"', async () => {",
        "  await sut.http.stop();",
        '  await sut.http.start([], { env: { DEMO_GREETING: "hi" } });',
        "});",
        "await then('the greeting is \"hi\"', async () => {",
        '  expect(before.body).toEqual({ text: "hello" });',
        '  expect((await sut.http.get("/greeting")).body).toEqual({ text: "hi" });',
        "});",
      ],
    });
  });

  await given(
    'its system test starts it with "DEMO_GREETING" "hello", stops it, starts it with "hi" and expects "hi"',
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
