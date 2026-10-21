import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-045", async ({ sut, given, when, then }) => {
  await given(
    'a module whose system test puts "$INPUT/a.txt" and expects sut.files.path of "$INPUT/a.txt" to be an absolute path that ends with "/input/a.txt"',
    async () => {
      const module = demoModule({
        steps: ['Given the file "a.txt"', 'Then its path ends with "/input/a.txt"'],
        test: [
          "await given('the file \"a.txt\"', async () => {",
          '  await sut.files.put("$INPUT/a.txt", "a");',
          "});",
          "await then('its path ends with \"/input/a.txt\"', async () => {",
          '  expect(sut.files.path("$INPUT/a.txt")).toMatch(/^\\/.+\\/input\\/a\\.txt$/);',
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
