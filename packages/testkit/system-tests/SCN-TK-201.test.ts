import { scenario } from "@opensoftware/testkit";
import { outlineModule, testCases } from "./module.ts";

scenario("SCN-TK-201", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose Outline "SCN-DEMO-001" has the rows "alpha", "beta" and "a\\|b" of the column "word"',
    async () => {
      module = outlineModule(["| word |", "| alpha |", "| beta |", "| a\\|b |"], "<word>", [
        "console.log(`row ${example.word}`);",
        'expect(await sut.files.list("$OUTPUT")).toEqual([]);',
        'await sut.files.put("$OUTPUT/seen.txt", example.word);',
      ]);
    },
  );

  await given(
    'its system test prints the word of its row, expects an empty "$OUTPUT", writes a file there and expects the CLI to print the word',
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

  await then('the output has the words "alpha", "beta" and "a|b" that the test printed', async () => {
    for (const word of ["alpha", "beta", "a|b"]) expect(run.stdout + run.stderr).toContain(`row ${word}\n`);
  });

  await then('"report.xml" has one test case, the passed "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toEqual([{ name: "SCN-DEMO-001", failed: false }]);
  });
});
