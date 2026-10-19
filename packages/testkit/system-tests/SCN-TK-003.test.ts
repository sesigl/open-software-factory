import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-003", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose README quick start runs "npx demo hello" and promises "$OUTPUT/hello.txt"', async () => {
    module = demoModule({
      bin: [
        'import { writeFileSync } from "node:fs";',
        'if (process.argv[2] === "hello") writeFileSync(`${process.env.OUTPUT}/hello.txt`, "hello\\n");',
        "",
      ].join("\n"),
      readme: [
        "# demo",
        "",
        "## Quick start",
        "",
        "```sh",
        "npx demo hello",
        "```",
        "",
        "It writes `$OUTPUT/hello.txt`.",
        "",
      ].join("\n"),
      steps: [
        "When the user runs the quick start command from the README",
        "Then the output folder contains the file the README promises",
      ],
      test: [
        'await when("the user runs the quick start command from the README", async () => {',
        "  await sut.cli(sut.readme.quickStartArgs());",
        "});",
        'await then("the output folder contains the file the README promises", async () => {',
        '  expect(await sut.files.list("$OUTPUT")).toContain(sut.readme.quickStartOutput());',
        "});",
      ],
    });
  });

  await given(
    "its system test runs the arguments of sut.readme.quickStartArgs and expects the file of sut.readme.quickStartOutput",
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

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});
