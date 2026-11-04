import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-125", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI sends a PostgreSQL SSL request to "DEMO_DATABASE_URL" and prints the answer',
    async () => {
      module = demoModule({
        bin: [
          'import { connect } from "node:net";',
          "const url = new URL(process.env.DEMO_DATABASE_URL);",
          "const socket = connect(Number(url.port), url.hostname, () => socket.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47])));",
          'socket.once("data", (data) => {',
          "  process.stdout.write(`postgres answered ${String.fromCharCode(data[0])}`);",
          "  socket.end();",
          "});",
          'socket.on("error", (error) => {',
          "  process.stdout.write(String(error));",
          "  process.exitCode = 1;",
          "});",
          "",
        ].join("\n"),
        readme: [
          "# demo",
          "",
          "## Configuration",
          "",
          "| Variable | Meaning |",
          "| --- | --- |",
          "| `DEMO_DATABASE_URL` | PostgreSQL URL. |",
          "",
        ].join("\n"),
        steps: ['When the user runs "demo" after the database stopped', 'Then the output says "ECONNREFUSED"'],
        test: [
          "const db = await fakes.postgres();",
          "await db.stop();",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\" after the database stopped', async () => {",
          "  run = await sut.cli([], { env: { DEMO_DATABASE_URL: db.url } });",
          "});",
          'await then("the output says \\"ECONNREFUSED\\"", async () => {',
          '  expect(run.stdout).toContain("ECONNREFUSED");',
          "});",
        ],
      });
    },
  );

  await given(
    'its system test stops fakes.postgres before it runs the module and expects the output to say "ECONNREFUSED"',
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
