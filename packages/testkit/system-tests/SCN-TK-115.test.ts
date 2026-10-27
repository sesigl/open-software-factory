import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-115", async ({ sut, given, when, then }) => {
  const chart: Record<string, string> = {};
  await given('a module whose chart "chart" has the service "events", a NATS server on port 8222', async () => {
    chart["$INPUT/chart/Chart.yaml"] = ["apiVersion: v2", "name: events", "version: 0.1.0", ""].join("\n");
    chart["$INPUT/chart/templates/events.yaml"] = [
      "apiVersion: apps/v1",
      "kind: Deployment",
      "metadata: { name: events }",
      "spec:",
      "  selector: { matchLabels: { app: events } }",
      "  template:",
      "    metadata: { labels: { app: events } }",
      "    spec:",
      "      containers:",
      "        - name: nats",
      "          image: nats:2.11.9-alpine",
      "          args: [--http_port=8222]",
      "          readinessProbe: { httpGet: { path: /healthz, port: 8222 }, periodSeconds: 1 }",
      "---",
      "apiVersion: v1",
      "kind: Service",
      "metadata: { name: events }",
      "spec:",
      "  selector: { app: events }",
      "  ports: [{ port: 8222 }]",
      "",
    ].join("\n");
  });

  await given(
    'its system test runs "install events chart --wait" with sut.helm, reads "/healthz" at the URL of "events" port 8222 and expects "ok"',
    async () => {
      const module = demoModule({
        steps: ['When the user installs "chart"', 'Then "/healthz" of "events" says "ok"'],
        test: [
          'const helm = sut.helm("chart");',
          "await when('the user installs \"chart\"', async () => {",
          '  const install = await helm.run(["install", "events", helm.chart, "--wait"]);',
          "  expect(install.exitCode, install.stderr).toBe(0);",
          "});",
          'await then(\'"/healthz" of "events" says "ok"\', async () => {',
          '  const response = await fetch(`${await helm.url("events", 8222)}/healthz`);',
          '  expect(await response.json()).toEqual({ status: "ok" });',
          "});",
        ],
      });
      for (const [path, content] of Object.entries({ ...module, ...chart })) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    // The testkit starts the module with a minimal environment: the cluster's kubeconfig is passed on.
    const cluster: Record<string, string> = process.env.KUBECONFIG ? { KUBECONFIG: process.env.KUBECONFIG } : {};
    run = await sut.cli(["run", "--junit", "report.xml"], { env: cluster });
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
