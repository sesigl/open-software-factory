import { scenario } from "@opensoftware/testkit";
import { demoModule } from "./module.ts";

scenario("SCN-TK-015", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose server prints "port is taken" and exits with code 1', async () => {
    module = demoModule({
      bin: ['process.stderr.write("port is taken\\n");', "process.exit(1);", ""].join("\n"),
      readme: [
        "# demo",
        "",
        "## Configuration",
        "",
        "| Variable | Meaning |",
        "| --- | --- |",
        "| `PORT` | Port the server listens on. |",
        "",
      ].join("\n"),
      steps: ["When the user starts the server", "Then the server answers"],
      test: [
        'await when("the user starts the server", async () => {',
        "  await sut.http.start();",
        "});",
        'await then("the server answers", async () => {',
        '  expect((await sut.http.get("/")).status).toBe(200);',
        "});",
      ],
    });
  });

  await given("its system test starts it with sut.http", async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "the server exited with code 1 before it listened on PORT"', async () => {
    expect(run.stdout + run.stderr).toContain("the server exited with code 1 before it listened on PORT");
  });

  await then('the output contains "port is taken"', async () => {
    expect(run.stdout + run.stderr).toContain("port is taken");
  });
});
