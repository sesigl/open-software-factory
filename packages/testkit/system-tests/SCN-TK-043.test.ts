import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-043", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI posts {"n":1} to "/v1/traces" at "DEMO_API_URL" with the header "authorization" set to "Bearer demo"',
    async () => {
      bin = [
        "const response = await fetch(`${process.env.DEMO_API_URL}/v1/traces`, {",
        '  method: "POST",',
        '  headers: { authorization: "Bearer demo" },',
        "  body: '{\"n\":1}',",
        "});",
        "process.stdout.write(String(response.status));",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test expects the fake to have received the header "authorization" with "Bearer demo" at "POST /v1/traces"',
    async () => {
      const module = demoModule({
        bin,
        readme:
          "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_API_URL` | Base URL of the API. |\n",
        steps: ['When the user runs "demo"', "Then the fake received the header"],
        test: [
          'const api = await fakes.http([{ method: "POST", path: "/v1/traces", body: {} }]);',
          "await when('the user runs \"demo\"', async () => {",
          "  await sut.cli([], { env: { DEMO_API_URL: api.url } });",
          "});",
          "await then('the fake received the header', async () => {",
          "  expect(api.headers()).toMatchObject([",
          '    { method: "POST", path: "/v1/traces", headers: { authorization: "Bearer demo" } },',
          "  ]);",
          "});",
        ],
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
