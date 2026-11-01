import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-123", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI serves "hello" on the local socket "demo.sock" and connects to it with the path alone',
    async () => {
      module = demoModule({
        bin: [
          'import net from "node:net";',
          'const server = net.createServer((client) => client.end("hello")).listen("demo.sock", () => {',
          "  const socket = new net.Socket();",
          '  socket.on("data", (data) => process.stdout.write(`answer ${data}\\n`));',
          '  socket.on("error", (error) => process.stdout.write(`${error.message}\\n`));',
          '  socket.on("close", () => server.close());',
          // The path alone, as a driver such as pg passes a Unix socket.
          '  socket.connect("demo.sock");',
          "});",
          "",
        ].join("\n"),
        readme: ["# demo", "", "## Configuration", "", "| Variable | Meaning |", "| --- | --- |", ""].join("\n"),
        steps: ['When the user runs "demo"', 'Then the output is "answer hello"'],
        test: [
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([]);",
          "});",
          "await then('the output is \"answer hello\"', async () => {",
          '  expect(run.stdout).toBe("answer hello\\n");',
          "});",
        ],
      });
    },
  );

  await given('its system test runs it and expects "answer hello"', async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

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
