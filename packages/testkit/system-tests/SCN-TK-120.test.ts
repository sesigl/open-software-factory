import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-120", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI runs curl in a container that sends "hello from a container" to the chat completions API at "DEMO_MODEL_URL" and prints the answer',
    async () => {
      module = demoModule({
        bin: [
          'import { spawnSync } from "node:child_process";',
          'const body = JSON.stringify({ model: "demo", messages: [{ role: "user", content: "hello from a container" }] });',
          "const args = ['run', '--rm', '--add-host', 'host.docker.internal:host-gateway', 'curlimages/curl:8.17.0', '-sS',",
          "  '-H', 'content-type: application/json', '--data', body, `${process.env.DEMO_MODEL_URL}/chat/completions`];",
          "const run = spawnSync('docker', args, { encoding: 'utf8' });",
          "process.stderr.write(run.stderr);",
          "console.log(JSON.parse(run.stdout).choices[0].message.content);",
          "",
        ].join("\n"),
        readme: [
          "# demo",
          "",
          "## Configuration",
          "",
          "| Variable | Meaning |",
          "| --- | --- |",
          "| `DEMO_MODEL_URL` | Base URL of the model gateway. |",
          "",
        ].join("\n"),
        steps: ['When the user runs "demo"', 'Then the output is "hello back"'],
        test: [
          "const gateway = await fakes.modelGateway([{ when: 'hello from a container', reply: 'hello back' }], { containers: true });",
          "let run;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_MODEL_URL: String(gateway.containerUrl) } });",
          "});",
          'await then("the output is \\"hello back\\"", async () => {',
          "  expect(run.stdout.trim(), run.stderr).toBe('hello back');",
          "});",
        ],
      });
    },
  );

  await given(
    'its system test scripts the reply "hello back" for that call, passes the container URL of the model gateway for containers and expects "hello back"',
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
