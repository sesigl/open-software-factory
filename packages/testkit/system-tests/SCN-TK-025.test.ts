import { scenario } from "@opensoftware/testkit";
import { demoModule } from "./module.ts";

scenario("SCN-TK-025", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose CLI fetches "https://example.com/"', async () => {
    module = demoModule({
      bin: [
        'const answer = await fetch("https://example.com/").then(',
        '  () => "reached",',
        "  (error) => String(error.cause ?? error),",
        ");",
        "process.stdout.write(`${answer}\\n`);",
        "",
      ].join("\n"),
      readme: ["# demo", "", "## Configuration", "", "| Variable | Meaning |", "| --- | --- |", ""].join("\n"),
      steps: ['When the user runs "demo"', "Then the command prints a line"],
      test: [
        "let run: Awaited<ReturnType<typeof sut.cli>>;",
        "await when('the user runs \"demo\"', async () => {",
        "  run = await sut.cli([]);",
        "});",
        'await then("the command prints a line", async () => {',
        "  expect(run.stdout).toMatch(/\\n$/);",
        "});",
      ],
    });
  });

  await given("its system test runs it and expects any output", async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "NOREAL: the module tried to reach example.com:443"', async () => {
    expect(run.stdout + run.stderr).toContain("NOREAL: the module tried to reach example.com:443");
  });
});
