import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-135", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose server writes "started" to its error output when it starts and "greeted" for each "GET /greeting"',
    async () => {
      module = demoModule({
        bin: [
          'import { createServer } from "node:http";',
          'process.stderr.write("started\\n");',
          "createServer((request, response) => {",
          '  process.stderr.write("greeted\\n");',
          '  response.writeHead(200, { "content-type": "application/json" });',
          '  response.end(JSON.stringify({ text: "hello" }));',
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
        steps: [
          "When the user restarts the server and reads the greeting",
          'Then the error output is "started", "started", "greeted"',
        ],
        test: [
          "await sut.http.start();",
          "await when('the user restarts the server and reads the greeting', async () => {",
          "  await sut.http.stop();",
          "  await sut.http.start();",
          '  await sut.http.get("/greeting");',
          "});",
          'await then(\'the error output is "started", "started", "greeted"\', async () => {',
          '  expect(sut.http.output().stderr).toBe("started\\nstarted\\ngreeted\\n");',
          "});",
        ],
      });
    },
  );

  await given(
    'its system test starts it, stops it, starts it again, reads "/greeting" and expects the error output "started", "started" and "greeted"',
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
