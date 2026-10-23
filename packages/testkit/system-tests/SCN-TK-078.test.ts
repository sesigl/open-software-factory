import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-078", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI runs curl in a container for "/v0.1/servers?search=tracker" at "DEMO_API_URL" and prints the body',
    async () => {
      bin = [
        'import { spawnSync } from "node:child_process";',
        "const url = `${process.env.DEMO_API_URL}/v0.1/servers?search=tracker`;",
        "const args = ['run', '--rm', '--add-host', 'host.docker.internal:host-gateway', 'curlimages/curl:8.17.0', '-sS', url];",
        "const run = spawnSync('docker', args, { encoding: 'utf8' });",
        "process.stdout.write(run.stdout);",
        "process.stderr.write(run.stderr);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test scripts {"count":1} for that path on a fake for containers and passes its container URL',
    async () => {
      const module = demoModule({
        bin,
        readme:
          "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_API_URL` | Base URL of the API. |\n",
        steps: ['When the user runs "demo"', 'Then the output is {"count":1}'],
        test: [
          'const api = await fakes.http([{ path: "/v0.1/servers?search=tracker", body: { count: 1 } }], { containers: true });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_API_URL: api.containerUrl } });",
          "});",
          "await then('the output is {\"count\":1}', async () => {",
          "  expect(run.stdout, run.stderr).toBe('{\"count\":1}');",
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
