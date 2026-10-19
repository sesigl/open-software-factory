import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-004", async ({ sut, given, when, then }) => {
  await given(
    'a module whose system test puts "$INPUT/a.txt", runs sut.files.clear on "$INPUT" and expects an empty list of "$INPUT"',
    async () => {
      const module = demoModule({
        steps: ['Given the file "a.txt"', 'When the test clears "$INPUT"', 'Then "$INPUT" is empty'],
        test: [
          "await given('the file \"a.txt\"', async () => {",
          '  await sut.files.put("$INPUT/a.txt", "a");',
          "});",
          "await when('the test clears \"$INPUT\"', async () => {",
          '  await sut.files.clear("$INPUT");',
          "});",
          "await then('\"$INPUT\" is empty', async () => {",
          '  expect(await sut.files.list("$INPUT")).toEqual([]);',
          "});",
        ],
      });
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
