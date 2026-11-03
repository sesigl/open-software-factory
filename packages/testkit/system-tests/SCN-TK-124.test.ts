import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-124", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI sends "Say hello" to the chat completions endpoint at "DEMO_MODEL_URL" with the header "x-demo-key" "k1"',
    async () => {
      module = demoModule({
        bin: [
          "await fetch(`${process.env.DEMO_MODEL_URL}/chat/completions`, {",
          '  method: "POST",',
          '  headers: { "content-type": "application/json", "X-Demo-Key": "k1" },',
          '  body: JSON.stringify({ model: "demo", messages: [{ role: "user", content: "Say hello" }] }),',
          "});",
          "",
        ].join("\n"),
        readme:
          "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_MODEL_URL` | Base URL of the model API. |\n",
        steps: ['When the user runs "demo"', 'Then the gateway\'s call has the header "x-demo-key" "k1"'],
        test: [
          'const gateway = await fakes.modelGateway([{ when: "Say hello", reply: "Hello" }]);',
          "await when('the user runs \"demo\"', async () => {",
          "  await sut.cli([], { env: { DEMO_MODEL_URL: gateway.url } });",
          "});",
          'await then(\'the gateway\\\'s call has the header "x-demo-key" "k1"\', async () => {',
          '  expect(gateway.calls[0]?.headers["x-demo-key"]).toBe("k1");',
          "});",
        ],
      });
    },
  );

  await given('its system test expects the gateway\'s call to have the header "x-demo-key" "k1"', async () => {
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
