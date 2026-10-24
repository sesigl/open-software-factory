import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-093", async ({ sut, given, when, then }) => {
  await given(
    'a module beside the built adapter "adapters/demo/echo", whose program prints "echo" and its arguments',
    async () => {
      const manifest = { name: "demo-echo", version: "0.1.0", type: "module", bin: { echo: "dist/echo.js" } };
      await sut.files.put("$INPUT/adapters/demo/echo/package.json", `${JSON.stringify(manifest)}\n`);
      await sut.files.put(
        "$INPUT/adapters/demo/echo/dist/echo.js",
        'process.stdout.write(["echo", ...process.argv.slice(2)].join(" "));\n',
      );
    },
  );

  let module: Record<string, string> = {};
  await given(
    'its system test passes sut.adapter("demo/echo") to the module as "DEMO_ADAPTER", and the module runs it with "hi" and prints what it printed',
    async () => {
      module = demoModule({
        bin: [
          'import { execFileSync } from "node:child_process";',
          'const [program, ...words] = process.env.DEMO_ADAPTER.split(" ");',
          'process.stdout.write(execFileSync(program, [...words, "hi"], { encoding: "utf8" }));',
          "",
        ].join("\n"),
        readme:
          "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_ADAPTER` | The adapter. |\n",
        steps: ['When the user runs "demo"', 'Then the output is "echo hi"'],
        test: [
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          '  run = await sut.cli([], { env: { DEMO_ADAPTER: sut.adapter("demo/echo") } });',
          "});",
          "await then('the output is \"echo hi\"', async () => {",
          '  expect(run.stdout).toBe("echo hi");',
          "});",
        ],
      });
    },
  );

  await given('its system test expects the output "echo hi"', async () => {
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
