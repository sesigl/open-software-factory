import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-014", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose server answers "GET /greeting" on "PORT" with the JSON text "hello"', async () => {
    module = demoModule({
      bin: [
        'import { createServer } from "node:http";',
        "createServer((request, response) => {",
        '  if (request.method === "GET" && request.url === "/greeting") {',
        '    response.writeHead(200, { "content-type": "application/json" });',
        '    response.end(JSON.stringify({ text: "hello" }));',
        "    return;",
        "  }",
        "  response.writeHead(404).end();",
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
        "",
      ].join("\n"),
      steps: ["When the user asks the server for the greeting", 'Then the greeting is "hello"'],
      test: [
        'type Paths = { "/greeting": { get: { responses: { 200: { content: { "application/json": { text: string } } } } } } };',
        "let plain: Awaited<ReturnType<typeof sut.http.get>>;",
        "let typed: { text: string } | undefined;",
        'await when("the user asks the server for the greeting", async () => {',
        "  await sut.http.start();",
        '  plain = await sut.http.get("/greeting");',
        '  typed = (await sut.http.client<Paths>().GET("/greeting")).data;',
        "});",
        "await then('the greeting is \"hello\"', async () => {",
        '  expect(plain.body).toEqual({ text: "hello" });',
        '  expect(typed?.text).toBe("hello");',
        "});",
      ],
    });
  });

  await given(
    'its system test starts it with sut.http and expects "hello" from the plain and the typed client',
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
