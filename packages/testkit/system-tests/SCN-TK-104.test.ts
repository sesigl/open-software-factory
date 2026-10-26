import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

/** A demo server that keeps "<title> <level>" of each alert whose signature matches DEMO_SENTRY_SECRET. */
const SERVER = [
  'import { createHmac } from "node:crypto";',
  'import { createServer } from "node:http";',
  "const kept = [];",
  "createServer(async (request, response) => {",
  '  let body = "";',
  "  for await (const chunk of request) body += chunk;",
  '  if (request.method === "GET") {',
  '    response.writeHead(200, { "content-type": "application/json" });',
  "    return response.end(JSON.stringify(kept));",
  "  }",
  '  const mac = createHmac("sha256", process.env.DEMO_SENTRY_SECRET).update(body).digest("hex");',
  '  if (request.headers["sentry-hook-signature"] !== mac) return response.writeHead(401).end();',
  "  const { event } = JSON.parse(body).data;",
  "  kept.push(`${event.title} ${event.level}`);",
  "  response.writeHead(200).end();",
  '}).listen(Number(process.env.PORT), "127.0.0.1");',
  "",
];

const README = [
  "# demo",
  "",
  "## Configuration",
  "",
  "| Variable | Meaning |",
  "| --- | --- |",
  "| `PORT` | Port the server listens on. |",
  "| `DEMO_SENTRY_SECRET` | Client secret of the Sentry integration. |",
  "",
].join("\n");

scenario("SCN-TK-104", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose server keeps the title and level of each alert whose Sentry-Hook-Signature matches "DEMO_SENTRY_SECRET"',
    async () => {
      module = demoModule({
        bin: SERVER.join("\n"),
        readme: README,
        steps: [
          'When Sentry sends the alert "TypeError: total is undefined" of level "fatal"',
          'Then the server has "TypeError: total is undefined fatal"',
        ],
        test: [
          "const sentry = await fakes.sentry();",
          "const url = await sut.http.start([], { env: { DEMO_SENTRY_SECRET: sentry.clientSecret } });",
          'await when(\'Sentry sends the alert "TypeError: total is undefined" of level "fatal"\', async () => {',
          '  const alert = await sentry.alert(`${url}/alerts`, { title: "TypeError: total is undefined", level: "fatal" });',
          "  expect(alert.status).toBe(200);",
          "});",
          "await then('the server has \"TypeError: total is undefined fatal\"', async () => {",
          '  expect((await sut.http.get("/kept")).body).toEqual(["TypeError: total is undefined fatal"]);',
          "});",
        ],
      });
    },
  );

  await given(
    'its system test has fakes.sentry send the alert "TypeError: total is undefined" of level "fatal" and expects "TypeError: total is undefined fatal"',
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
