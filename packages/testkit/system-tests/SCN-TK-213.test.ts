import { scenario } from "@opensoftware/testkit";
import { demoModule, groupModule, testCases } from "./module.ts";

/** A scenario of the group "chart": its shared start counts itself in "starts.log" and installs "chart". */
const sharedChart = {
  tags: "@shared=chart",
  steps: ['Given the shared start "chart", which installs "chart"', 'Then the ConfigMap "greeting" says "hello"'],
  test: [
    'const { appendFileSync } = await import("node:fs");',
    "let shared!: Awaited<ReturnType<typeof sut.shared>>;",
    'await given(\'the shared start "chart", which installs "chart"\', async () => {',
    '  shared = await sut.shared("chart", async (start) => {',
    '    appendFileSync(new URL("../starts.log", import.meta.url), "start\\n");',
    '    const helm = start.helm("chart");',
    '    const install = await helm.run(["install", "greeting", helm.chart]);',
    "    if (install.exitCode !== 0) throw new Error(install.stderr);",
    "    return helm.namespace;",
    "  });",
    "});",
    'await then(\'the ConfigMap "greeting" says "hello"\', async () => {',
    '  const helm = shared.sut.helm("chart");',
    "  expect(helm.namespace).toBe(shared.result);",
    '  appendFileSync(new URL("../namespaces.log", import.meta.url), `${helm.namespace}\\n`);',
    '  const read = await helm.kubectl(["get", "configmap", "greeting", "--output", "jsonpath={.data.text}"]);',
    '  expect(read.stdout, read.stderr).toBe("hello");',
    "});",
  ],
};

scenario("SCN-TK-213", async ({ sut, given, when, then }) => {
  // The testkit starts the module with a minimal environment: the cluster's kubeconfig is passed on.
  const cluster: Record<string, string> = process.env.KUBECONFIG ? { KUBECONFIG: process.env.KUBECONFIG } : {};
  const module = groupModule([sharedChart, sharedChart]);

  await given('a module whose chart "chart" has the ConfigMap "greeting"', async () => {
    await sut.files.put(
      "$INPUT/chart/Chart.yaml",
      ["apiVersion: v2", "name: greeting", "version: 0.1.0", ""].join("\n"),
    );
    await sut.files.put(
      "$INPUT/chart/templates/greeting.yaml",
      ["apiVersion: v1", "kind: ConfigMap", "metadata:", "  name: greeting", "data:", "  text: hello", ""].join("\n"),
    );
  });

  await given(
    'its scenarios "SCN-DEMO-001" and "SCN-DEMO-002" carry the tag "@shared=chart", each with a test file of its own',
    async () => {
      for (const [path, content] of Object.entries(module)) {
        if (!path.includes("/system-tests/")) await sut.files.put(path, content);
      }
    },
  );

  await given(
    'each test installs the chart with sut.helm in the shared start "chart", which counts its starts, and then reads the ConfigMap in the shared namespace',
    async () => {
      for (const [path, content] of Object.entries(module)) {
        if (path.includes("/system-tests/")) await sut.files.put(path, content);
      }
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"], { env: cluster });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test cases "SCN-DEMO-001" and "SCN-DEMO-002"', async () => {
    const cases = testCases(await sut.files.read("$INPUT/report.xml"));
    expect(cases).toContainEqual({ name: "SCN-DEMO-001", failed: false });
    expect(cases).toContainEqual({ name: "SCN-DEMO-002", failed: false });
  });

  await then(
    "the shared start ran once, both tests read the same namespace, and that namespace is deleted or in deletion",
    async () => {
      expect(await sut.files.read("$INPUT/starts.log")).toBe("start\n");
      const namespaces = (await sut.files.read("$INPUT/namespaces.log")).split("\n").filter(Boolean);
      expect(namespaces).toHaveLength(2);
      expect(new Set(namespaces).size).toBe(1);
      // A second run, of a scenario of its own, looks at the cluster after the first run ended.
      const check = demoModule({
        steps: ["Then the namespace is gone"],
        test: [
          'const helm = sut.helm("chart");',
          "await then('the namespace is gone', async () => {",
          `  const left = await helm.kubectl(["get", "namespace", "${namespaces[0]}", "--output", "jsonpath={.metadata.deletionTimestamp}"]);`,
          '  expect(left.exitCode !== 0 || left.stdout.trim() !== "", `the namespace is still there: ${left.stdout}`).toBe(true);',
          "});",
        ],
      });
      for (const [path, content] of Object.entries(check)) await sut.files.put(path, content);
      await sut.files.remove("$INPUT/system-tests/SCN-DEMO-002.test.ts");
      const second = await sut.cli(["run", "--junit", "second.xml"], { env: cluster });
      expect(second.exitCode, second.stdout + second.stderr).toBe(0);
    },
  );
});
