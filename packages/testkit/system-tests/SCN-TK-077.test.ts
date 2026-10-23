import { scenario } from "@opensoftware/testkit";
import { openaiModule, testCases } from "./module.ts";

scenario("SCN-TK-077", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI streams a chat completions call that contains "fix the typo" from "DEMO_MODEL_URL" twice and prints each text and finish reason',
    async () => {
      module = openaiModule(
        [
          "for (const _ of [1, 2]) {",
          '  const all = await events(await call("/chat/completions", { messages: [{ role: "user", content: "fix the typo" }] }));',
          "  const choices = all.flatMap((event) => event.choices);",
          '  const text = choices.map((choice) => choice.delta.content ?? "").join("");',
          "  process.stdout.write(`${text} ${choices.find((choice) => choice.finish_reason).finish_reason}\\n`);",
          "}",
        ],
        ['When the user runs "demo"', 'Then the output is "first stop" and "second content_filter"'],
        [
          'const gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "first" }, { when: "fix the typo", reply: "second", stopReason: "content_filter" }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_MODEL_URL: gateway.url } });",
          "});",
          'await then(\'the output is "first stop" and "second content_filter"\', async () => {',
          '  expect(run.stdout, run.stderr).toBe("first stop\\nsecond content_filter\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts the reply "first" and the reply "second" with the finish reason "content_filter" for requests that contain "fix the typo", and expects "first stop" and "second content_filter"',
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
