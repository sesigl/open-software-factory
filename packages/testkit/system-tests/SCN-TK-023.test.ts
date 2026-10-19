import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-023", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose CLI counts its runs in a file in "OSF_DATA" and prints the count', async () => {
    module = demoModule({
      bin: [
        'import { existsSync, readFileSync, writeFileSync } from "node:fs";',
        'import { join } from "node:path";',
        'const file = join(process.env.OSF_DATA, "count");',
        'const count = (existsSync(file) ? Number(readFileSync(file, "utf8")) : 0) + 1;',
        "writeFileSync(file, String(count));",
        "process.stdout.write(`${count}\\n`);",
        "",
      ].join("\n"),
      readme: [
        "# demo",
        "",
        "## Configuration",
        "",
        "| Variable | Meaning |",
        "| --- | --- |",
        "| `OSF_DATA` | Folder for the module's own state. |",
        "",
      ].join("\n"),
      steps: ['When the user runs "demo" twice', 'Then the output is "2"', "And $INPUT and $OUTPUT have no new file"],
      test: [
        'const before = await sut.files.list("$INPUT");',
        "let run: Awaited<ReturnType<typeof sut.cli>>;",
        "await when('the user runs \"demo\" twice', async () => {",
        "  await sut.cli([]);",
        "  run = await sut.cli([]);",
        "});",
        "await then('the output is \"2\"', async () => {",
        '  expect(run.stdout).toBe("2\\n");',
        "});",
        'await then("$INPUT and $OUTPUT have no new file", async () => {',
        '  expect(await sut.files.list("$INPUT")).toEqual(before);',
        '  expect(await sut.files.list("$OUTPUT")).toEqual([]);',
        "});",
      ],
    });
  });

  await given('its system test runs it twice and expects "2" and no new file in $INPUT or $OUTPUT', async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

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
