import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-017", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose CLI publishes a "pr.opened" CloudEvent on "osf.events" at "DEMO_NATS_URL"', async () => {
    module = demoModule({
      bin: [
        'import { connect } from "node:net";',
        "const url = new URL(process.env.DEMO_NATS_URL);",
        'const event = JSON.stringify({ specversion: "1.0", id: "1", source: "demo", type: "pr.opened", data: { number: 1 } });',
        "const socket = connect(Number(url.port), url.hostname);",
        'socket.once("data", () => {',
        '  socket.write(`CONNECT {"verbose":false}\\r\\nPUB osf.events ${Buffer.byteLength(event)}\\r\\n${event}\\r\\nPING\\r\\n`);',
        '  socket.on("data", (data) => String(data).includes("PONG") && socket.end());',
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
      steps: ['When the user runs "demo"', 'Then one "pr.opened" event was published'],
      test: [
        "const nats = await fakes.nats();",
        'const log = await sut.events.watch(nats, "osf.events");',
        "await when('the user runs \"demo\"', async () => {",
        "  const run = await sut.cli([], { env: { DEMO_NATS_URL: nats.url } });",
        "  expect(run.exitCode, run.stderr).toBe(0);",
        "});",
        "await then('one \"pr.opened\" event was published', async () => {",
        '  const events = await log.received("pr.opened");',
        '  expect(events.map((event) => [event.source, event.data])).toEqual([["demo", { number: 1 }]]);',
        "});",
      ],
    });
  });

  await given('its system test watches fakes.nats with sut.events and expects one "pr.opened" event', async () => {
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
