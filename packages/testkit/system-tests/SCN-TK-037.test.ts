import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-037", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI gets "/checkout" from the API at "DEMO_API_URL" and prints the content type and the body',
    async () => {
      module = demoModule({
        bin: [
          "const response = await fetch(`${process.env.DEMO_API_URL}/checkout`);",
          'process.stdout.write(`${response.headers.get("content-type")} ${await response.text()}`);',
          "",
        ].join("\n"),
        readme:
          "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_API_URL` | Base URL of the API. |\n",
        steps: ['When the user runs "demo"', 'Then the output is "text/html <h1>Pay with a card</h1>"'],
        test: [
          'const api = await fakes.http([{ path: "/checkout", contentType: "text/html", body: "<h1>Pay with a card</h1>" }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_API_URL: api.url } });",
          "});",
          "await then('the output is \"text/html <h1>Pay with a card</h1>\"', async () => {",
          '  expect(run.stdout).toBe("text/html <h1>Pay with a card</h1>");',
          "});",
        ],
      });
    },
  );

  await given(
    'its system test scripts the answer "<h1>Pay with a card</h1>" with the content type "text/html" for "GET /checkout"',
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
