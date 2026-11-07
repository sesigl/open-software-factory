import { scenario } from "@opensoftware/testkit";
import { demoModule } from "./module.ts";

scenario("SCN-TK-128", async ({ sut, given, when, then }) => {
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
  await when(
    'the developer runs "testkit run --junit report.xml" with __STRYKER_ACTIVE_MUTANT__ "7" in the module',
    async () => {
      run = await sut.cli(["run", "--junit", "report.xml"], { env: { __STRYKER_ACTIVE_MUTANT__: "7" } });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"$INPUT/reports/coverage/" holds no file', async () => {
    const files = await sut.files.list("$INPUT/reports/coverage").catch(() => []);
    expect(files).toEqual([]);
  });
});
