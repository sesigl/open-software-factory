import { scenario } from "@opensoftware/testkit";
import { messagesModule, testCases } from "./module.ts";

scenario("SCN-TK-067", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI sends "fix the typo" to the Anthropic Messages endpoint at "DEMO_ANTHROPIC_URL" three times and prints each text',
    async () => {
      module = messagesModule(
        [
          "for (let i = 0; i < 3; i++) {",
          '  const { content } = await (await call("fix the typo")).json();',
          "  process.stdout.write(`${content[0].text}\\n`);",
          "}",
        ],
        ['When the user runs "demo"', 'Then the output is "first", "second" and "second"'],
        [
          "const gateway = await fakes.modelGateway([",
          '  { when: "fix the typo", reply: "first" },',
          '  { when: "fix the typo", reply: "second" },',
          "]);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_ANTHROPIC_URL: gateway.anthropicUrl } });",
          "});",
          'await then(\'the output is "first", "second" and "second"\', async () => {',
          '  expect(run.stdout, run.stderr).toBe("first\\nsecond\\nsecond\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts the replies "first" and "second" for requests that contain "fix the typo" and expects "first", "second" and "second"',
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
