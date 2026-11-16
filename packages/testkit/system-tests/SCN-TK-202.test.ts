import { scenario } from "@opensoftware/testkit";
import { outlineModule, testCases } from "./module.ts";

scenario("SCN-TK-202", async ({ sut, given, when, then }) => {
  await given(
    'a module whose Outline "SCN-DEMO-001" has the rows "alpha", "beta" and "gamma", and the row "beta" expects the output "BETA"',
    async () => {
      const rows = ["| word | output |", "| alpha | alpha |", "| beta | BETA |", "| gamma | gamma |"];
      const module = outlineModule(rows, "<output>", ["console.log(`row ${example.word}`);"]);
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('"report.xml" has the failed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toEqual([{ name: "SCN-DEMO-001", failed: true }]);
  });

  await then(
    `the output says "1 of 3 examples of SCN-DEMO-001 failed" and names "example 2 (word=beta, output=BETA)" and the failed step 'Then "the output is BETA"'`,
    async () => {
      expect(run.stdout + run.stderr).toContain(
        '1 of 3 examples of SCN-DEMO-001 failed:\n\nexample 2 (word=beta, output=BETA): Then "the output is BETA":',
      );
    },
  );

  await then('the output has the word "gamma" that the test printed after the failed row', async () => {
    const output = run.stdout + run.stderr;
    expect(output.indexOf("row gamma\n")).toBeGreaterThan(output.indexOf("row beta\n"));
    expect(output.indexOf("row beta\n")).toBeGreaterThan(-1);
  });
});
