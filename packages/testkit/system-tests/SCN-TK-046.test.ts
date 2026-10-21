import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-046", async ({ sut, given, when, then }) => {
  let options: Parameters<typeof demoModule>[0];
  await given("a library whose package.json has no bin", async () => {
    options = { library: true };
  });

  await given('its system test puts "$INPUT/a.txt" with the text "a" and expects to read "a" from it', async () => {
    const library = demoModule({
      ...options,
      steps: ['Given the file "a.txt" with the text "a"', 'Then the test reads "a" from it'],
      test: [
        'await given(\'the file "a.txt" with the text "a"\', async () => {',
        '  await sut.files.put("$INPUT/a.txt", "a");',
        "});",
        "await then('the test reads \"a\" from it', async () => {",
        '  expect(await sut.files.read("$INPUT/a.txt")).toBe("a");',
        "});",
      ],
    });
    for (const [path, content] of Object.entries(library)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the library', async () => {
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
