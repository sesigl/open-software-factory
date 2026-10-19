import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-011", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI creates the bucket "demo", puts "notes.txt" with "hello" at "DEMO_S3_ENDPOINT" and prints the object it reads back',
    async () => {
      module = demoModule({
        bin: [
          "const endpoint = process.env.DEMO_S3_ENDPOINT;",
          'await fetch(`${endpoint}/demo`, { method: "PUT" });',
          'await fetch(`${endpoint}/demo/notes.txt`, { method: "PUT", body: "hello" });',
          "process.stdout.write(await (await fetch(`${endpoint}/demo/notes.txt`)).text());",
          "",
        ].join("\n"),
        readme: [
          "# demo",
          "",
          "## Configuration",
          "",
          "| Variable | Meaning |",
          "| --- | --- |",
          "| `DEMO_S3_ENDPOINT` | S3 API endpoint. |",
          "",
        ].join("\n"),
        steps: ['When the user runs "demo"', 'Then the output is "hello"'],
        test: [
          "const s3 = await fakes.s3();",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_S3_ENDPOINT: s3.endpoint } });",
          "});",
          'await then("the output is \\"hello\\"", async () => {',
          '  expect(run.stdout).toBe("hello");',
          "});",
        ],
      });
    },
  );

  await given('its system test passes the endpoint of fakes.s3 and expects the output "hello"', async () => {
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
