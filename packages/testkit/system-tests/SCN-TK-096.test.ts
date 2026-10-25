import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-096", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(`a module whose CLI counts the mutant "7" in Stryker's coverage global`, async () => {
    module = demoModule({
      bin: 'globalThis.__stryker__ = { mutantCoverage: { static: { "7": 1 }, perTest: {} } };\n',
      steps: ['When the user runs "demo"', "Then the command exits with code 0"],
      test: [
        "let run: Awaited<ReturnType<typeof sut.cli>>;",
        "await when('the user runs \"demo\"', async () => {",
        "  run = await sut.cli([]);",
        "});",
        "await then('the command exits with code 0', async () => {",
        "  expect(run.exitCode).toBe(0);",
        "});",
      ],
    });
  });

  await given("its system test runs the CLI", async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit run --junit report.xml" with OSF_TESTKIT_MUTANTS "$OUTPUT/mutants" in the module',
    async () => {
      const mutants = sut.files.path("$OUTPUT/mutants");
      run = await sut.cli(["run", "--junit", "report.xml"], { env: { OSF_TESTKIT_MUTANTS: mutants } });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });

  await then('a file in "$OUTPUT/mutants/SCN-DEMO-001" lists the mutant "7"', async () => {
    const files = await sut.files.list("$OUTPUT/mutants/SCN-DEMO-001");
    const lists = await Promise.all(files.map((file) => sut.files.read(`$OUTPUT/mutants/SCN-DEMO-001/${file}`)));
    expect(lists.map((list) => JSON.parse(list))).toContainEqual(["7"]);
  });
});
