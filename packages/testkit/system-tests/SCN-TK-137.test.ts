import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-137", async ({ sut, given, when, then }) => {
  // A namespace of the cluster that no other scenario uses: named after this scenario's workspace.
  const extra = `${sut.files.path("$INPUT/x").split("/").at(-3)}-extra`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  // The testkit starts the module with a minimal environment: the cluster's kubeconfig is passed on.
  const cluster: Record<string, string> = process.env.KUBECONFIG ? { KUBECONFIG: process.env.KUBECONFIG } : {};
  const steps = ['When the user installs "chart"', 'Then the namespace "extra" is right'];

  await given('a module whose chart "chart" creates the namespace that its value "extra" names', async () => {
    await sut.files.put("$INPUT/chart/Chart.yaml", ["apiVersion: v2", "name: extra", "version: 0.1.0", ""].join("\n"));
    await sut.files.put(
      "$INPUT/chart/templates/extra.yaml",
      ["apiVersion: v1", "kind: Namespace", "metadata:", "  name: {{ .Values.extra }}", ""].join("\n"),
    );
  });

  await given(
    'its system test runs "install extra chart" with sut.helm and "extra" set to a namespace of this scenario',
    async () => {
      const module = demoModule({
        steps,
        test: [
          'const helm = sut.helm("chart");',
          "await when('the user installs \"chart\"', async () => {",
          `  const install = await helm.run(["install", "extra", helm.chart, "--set", "extra=${extra}"]);`,
          "  expect(install.exitCode, install.stderr).toBe(0);",
          "});",
          "await then('the namespace \"extra\" is right', async () => {",
          `  const found = await helm.kubectl(["get", "namespace", "${extra}"]);`,
          "  expect(found.exitCode, found.stderr).toBe(0);",
          "});",
        ],
      });
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  await given('the developer ran "testkit run --junit first.xml" in the module', async () => {
    const first = await sut.cli(["run", "--junit", "first.xml"], { env: cluster });
    expect(first.exitCode, first.stdout + first.stderr).toBe(0);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer changes the system test to expect that the namespace is deleted or in deletion and runs "testkit run --junit report.xml"',
    async () => {
      const module = demoModule({
        steps,
        test: [
          'const helm = sut.helm("chart");',
          "await when('the user installs \"chart\"', async () => {});",
          "await then('the namespace \"extra\" is right', async () => {",
          `  const left = await helm.kubectl(["get", "namespace", "${extra}", "--output", "jsonpath={.metadata.deletionTimestamp}"]);`,
          '  expect(left.exitCode !== 0 || left.stdout.trim() !== "", `the namespace is still there: ${left.stdout}`).toBe(true);',
          "});",
        ],
      });
      await sut.files.put(
        "$INPUT/system-tests/SCN-DEMO-001.test.ts",
        module["$INPUT/system-tests/SCN-DEMO-001.test.ts"] as string,
      );
      run = await sut.cli(["run", "--junit", "report.xml"], { env: cluster });
    },
  );

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
