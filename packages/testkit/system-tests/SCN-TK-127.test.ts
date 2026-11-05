import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

// The demo's test speaks the PostgreSQL protocol over a socket: startup, the cleartext password and BEGIN, sent at
// once. It stops the database when the answer to BEGIN says "in a transaction" (ReadyForQuery with status T).
const TEST = [
  "const db = await fakes.postgres();",
  'const { connect } = await import("node:net");',
  "const url = new URL(db.url);",
  "const typed = (type: string, text: string) => {",
  '  const body = Buffer.from(text, "utf8");',
  "  const head = Buffer.alloc(5);",
  "  head.write(type, 0);",
  "  head.writeInt32BE(body.length + 4, 1);",
  "  return Buffer.concat([head, body]);",
  "};",
  'const parameters = Buffer.from(`user\\0${url.username}\\0database\\0test\\0\\0`, "utf8");',
  "const startup = Buffer.alloc(8);",
  "startup.writeInt32BE(parameters.length + 8, 0);",
  "startup.writeInt32BE(196608, 4);",
  "await when('the test begins a transaction and stops the database', async () => {",
  '  const socket = connect(Number(url.port), "127.0.0.1");',
  "  socket.on('error', () => undefined);",
  "  let seen = Buffer.alloc(0);",
  "  const begun = new Promise<void>((resolve) => socket.on('data', (data: Buffer) => {",
  "    seen = Buffer.concat([seen, data]);",
  "    if (seen.includes(Buffer.from([0x5a, 0, 0, 0, 5, 0x54]))) resolve();",
  "  }));",
  "  socket.write(Buffer.concat([startup, parameters, typed('p', `${url.password}\\0`), typed('Q', 'BEGIN\\0')]));",
  "  await begun;",
  "  await db.stop();",
  "});",
  "await then('the test ends without an error', async () => {",
  "  expect(true).toBe(true);",
  "});",
];

scenario("SCN-TK-127", async ({ sut, given, when, then }) => {
  await given(
    "a module whose system test begins a transaction on fakes.postgres and then stops fakes.postgres",
    async () => {
      const module = demoModule({
        steps: ["When the test begins a transaction and stops the database", "Then the test ends without an error"],
        test: TEST,
      });
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
