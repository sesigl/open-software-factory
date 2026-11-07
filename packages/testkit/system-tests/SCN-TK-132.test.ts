import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-132", async ({ sut, given, when, then }) => {
  await given('a kubeconfig whose current context "shared" points to "https://cluster.example.invalid"', async () => {
    await sut.files.put(
      "$INPUT/kubeconfig",
      [
        "apiVersion: v1",
        "kind: Config",
        "clusters: [{ name: shared, cluster: { server: https://cluster.example.invalid } }]",
        "users: [{ name: shared, user: { token: none } }]",
        "contexts: [{ name: shared, context: { cluster: shared, user: shared } }]",
        "current-context: shared",
        "",
      ].join("\n"),
    );
  });

  await given(
    'a module whose system test runs "install events chart" with sut.helm and expects the error \'the current context "shared" is not a local kind cluster\'',
    async () => {
      const module = demoModule({
        steps: ['When the user installs "chart"', "Then sut.helm refuses the cluster"],
        test: [
          'const helm = sut.helm("chart");',
          "let refused: unknown;",
          "await when('the user installs \"chart\"', async () => {",
          '  refused = await helm.run(["install", "events", helm.chart]).catch((error: unknown) => error);',
          "});",
          'await then("sut.helm refuses the cluster", async () => {',
          "  expect(String(refused)).toContain('the current context \"shared\" is not a local kind cluster');",
          "});",
        ],
      });
      module["$INPUT/chart/Chart.yaml"] = ["apiVersion: v2", "name: events", "version: 0.1.0", ""].join("\n");
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit run --junit report.xml" in the module with "KUBECONFIG" set to that kubeconfig',
    async () => {
      run = await sut.cli(["run", "--junit", "report.xml"], {
        env: { KUBECONFIG: sut.files.path("$INPUT/kubeconfig") },
      });
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
