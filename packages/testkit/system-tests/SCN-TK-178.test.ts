import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";
import { BAO_CLI, BAO_README, RUN_BAO } from "./openbao.ts";

scenario("SCN-TK-178", async ({ sut, given, when, then }) => {
  await given(
    'a module whose CLI writes "demo" with the value "bao_test_1" to the mount "DEMO_BAO_MOUNT" of OpenBao at "DEMO_BAO_ADDR" with the token "DEMO_BAO_TOKEN", and prints the status and the token\'s "ttl"',
    async () => {
      await sut.files.put("$INPUT/bin/demo.js", BAO_CLI);
      await sut.files.put("$INPUT/README.md", BAO_README);
    },
  );

  await given(
    'its system test passes a token of fakes.openbao whose policy may only read the mount and that lives "10m", and expects the status 403 and a "ttl" of at most 600 seconds and more than 590',
    async () => {
      // The CLI and the README are in place; demoModule adds the package, the feature and the test.
      const { "$INPUT/bin/demo.js": _cli, ...module } = demoModule({
        steps: ['When the user runs "demo"', "Then OpenBao refused the write"],
        test: [
          "const bao = await fakes.openbao();",
          'const policy = `path "${bao.mount}/data/*" { capabilities = ["read"] }`;',
          'const token = await bao.token(policy, { ttl: "10m" });',
          ...RUN_BAO,
          "await then('OpenBao refused the write', async () => {",
          '  const [status, ttl] = run.stdout.split(" ").map(Number);',
          "  expect(status, run.stderr).toBe(403);",
          "  expect(ttl).toBeLessThanOrEqual(600);",
          "  expect(ttl).toBeGreaterThan(590);",
          '  expect(await bao.read("demo")).toBeUndefined();',
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
