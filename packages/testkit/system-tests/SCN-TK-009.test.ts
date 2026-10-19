import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-009", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose CLI connects to "DEMO_NATS_URL" and prints the first word the server sends', async () => {
    module = demoModule({
      bin: [
        'import { connect } from "node:net";',
        "const url = new URL(process.env.DEMO_NATS_URL);",
        "const socket = connect(Number(url.port), url.hostname);",
        'socket.once("data", (data) => {',
        '  process.stdout.write(String(data).split(" ")[0]);',
        "  socket.end();",
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
        "| `DEMO_NATS_URL` | NATS URL. |",
        "",
      ].join("\n"),
      steps: ['When the user runs "demo"', 'Then the output is "INFO"'],
      test: [
        "const nats = await fakes.nats();",
        "let run: Awaited<ReturnType<typeof sut.cli>>;",
        "await when('the user runs \"demo\"', async () => {",
        "  run = await sut.cli([], { env: { DEMO_NATS_URL: nats.url } });",
        "});",
        'await then("the output is \\"INFO\\"", async () => {',
        '  expect(run.stdout).toBe("INFO");',
        "});",
      ],
    });
  });

  await given('its system test passes the URL of fakes.nats and expects the output "INFO"', async () => {
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
