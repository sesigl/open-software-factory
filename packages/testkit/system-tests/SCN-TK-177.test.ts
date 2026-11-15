import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";
import { BAO_CLI, BAO_README, RUN_BAO } from "./openbao.ts";

scenario("SCN-TK-177", async ({ sut, given, when, then }) => {
  await given(
    'a module whose CLI writes "demo" with the value "bao_test_1" to the mount "DEMO_BAO_MOUNT" of OpenBao at "DEMO_BAO_ADDR" with the token "DEMO_BAO_TOKEN", and prints the status and the token\'s "ttl"',
    async () => {
      await sut.files.put("$INPUT/bin/demo.js", BAO_CLI);
      await sut.files.put("$INPUT/README.md", BAO_README);
    },
  );

  await given(
    'its system test passes a token of fakes.openbao whose policy may write the mount, expects the status 200 and reads "demo" back with the value "bao_test_1" and the version 1',
    async () => {
      // The CLI and the README are in place; demoModule adds the package, the feature and the test.
      const { "$INPUT/bin/demo.js": _cli, ...module } = demoModule({
        steps: ['When the user runs "demo"', "Then OpenBao holds the value"],
        test: [
          "const bao = await fakes.openbao();",
          'const token = await bao.token(`path "${bao.mount}/data/*" { capabilities = ["create", "update"] }`);',
          ...RUN_BAO,
          "await then('OpenBao holds the value', async () => {",
          '  expect(run.stdout.split(" ")[0], run.stderr).toBe("200");',
          '  expect(await bao.read("demo")).toEqual({ version: 1, data: { value: "bao_test_1" } });',
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
