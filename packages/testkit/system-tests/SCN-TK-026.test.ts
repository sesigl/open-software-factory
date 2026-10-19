import { scenario } from "@opensoftware/testkit";
import { demoModule, functionCounts } from "./module.ts";

scenario("SCN-TK-026", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module in a workspace whose CLI declares the functions "used" and "unused" and calls "used"',
    async () => {
      module = demoModule({
        bin: [
          "function used() {",
          '  return "hello";',
          "}",
          "function unused() {",
          '  return "never";',
          "}",
          "process.stdout.write(`${used()}\\n`);",
          "",
        ].join("\n"),
      });
      module["$INPUT/pnpm-workspace.yaml"] = "packages: []\n";
    },
  );

  await given("its system test runs the CLI", async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('a file in "$INPUT/reports/coverage/" shows that "bin/demo.js" ran "used" and not "unused"', async () => {
    const dir = "$INPUT/reports/coverage";
    const reports = await Promise.all((await sut.files.list(dir)).map((file) => sut.files.read(`${dir}/${file}`)));
    const counts = functionCounts(reports, "/bin/demo.js");
    expect(counts).toMatchObject({ used: 1, unused: 0 });
  });
});
