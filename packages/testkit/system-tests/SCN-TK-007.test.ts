import { scenario } from "@opensoftware/testkit";
import { demoModule } from "./module.ts";

scenario("SCN-TK-007", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI sends "Say hello" to the chat completions endpoint at "DEMO_MODEL_URL" and prints the reply',
    async () => {
      module = demoModule({
        bin: [
          "const response = await fetch(`${process.env.DEMO_MODEL_URL}/chat/completions`, {",
          '  method: "POST",',
          '  headers: { "content-type": "application/json" },',
          '  body: JSON.stringify({ model: "demo", messages: [{ role: "user", content: "Say hello" }] }),',
          "});",
          "const answer = await response.json();",
          "process.stdout.write(answer.choices?.[0]?.message?.content ?? `status ${response.status}`);",
          "",
        ].join("\n"),
        readme:
          "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_MODEL_URL` | Base URL of the model API. |\n",
        steps: ['When the user runs "demo"', 'Then the output is "Hello, Ada"'],
        test: [
          "const gateway = await fakes.modelGateway([]);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_MODEL_URL: gateway.url } });",
          "});",
          "await then('the output is \"Hello, Ada\"', async () => {",
          '  expect(run.stdout).toBe("Hello, Ada");',
          "});",
        ],
      });
    },
  );

  await given("its system test scripts no reply", async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "unscripted model call: POST /v1/chat/completions"', async () => {
    expect(run.stdout + run.stderr).toContain("unscripted model call: POST /v1/chat/completions");
  });

  await then('the output contains "Say hello"', async () => {
    expect(run.stdout + run.stderr).toContain("Say hello");
  });
});
