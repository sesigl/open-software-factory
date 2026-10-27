import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-116", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI runs curl in a container that posts "hello from a container" to the channel "C1" through the Slack Web API at "DEMO_SLACK_URL"',
    async () => {
      module = demoModule({
        bin: [
          'import { spawnSync } from "node:child_process";',
          'const body = JSON.stringify({ channel: "C1", text: "hello from a container" });',
          "const args = ['run', '--rm', '--add-host', 'host.docker.internal:host-gateway', 'curlimages/curl:8.17.0', '-sS',",
          "  '-H', `authorization: Bearer ${process.env.DEMO_SLACK_TOKEN}`, '-H', 'content-type: application/json',",
          "  '--data', body, `${process.env.DEMO_SLACK_URL}chat.postMessage`];",
          "const run = spawnSync('docker', args, { encoding: 'utf8' });",
          "process.stdout.write(run.stdout);",
          "process.stderr.write(run.stderr);",
          "",
        ].join("\n"),
        readme: [
          "# demo",
          "",
          "## Configuration",
          "",
          "| Variable | Meaning |",
          "| --- | --- |",
          "| `DEMO_SLACK_URL` | Slack Web API base URL. |",
          "| `DEMO_SLACK_TOKEN` | Slack bot token. |",
          "",
        ].join("\n"),
        steps: ['When the user runs "demo"', 'Then "C1" has the message "hello from a container"'],
        test: [
          "const slack = await fakes.slack({ containers: true });",
          "await when('the user runs \"demo\"', async () => {",
          "  const run = await sut.cli([], { env: { DEMO_SLACK_URL: String(slack.containerUrl), DEMO_SLACK_TOKEN: slack.token } });",
          "  expect(run.stdout, run.stderr).toContain('\"ok\":true');",
          "});",
          'await then("\\"C1\\" has the message \\"hello from a container\\"", async () => {',
          '  expect(slack.messages("C1").map((message) => message.text)).toEqual(["hello from a container"]);',
          "});",
        ],
      });
    },
  );

  await given(
    'its system test passes the container URL and token of fakes.slack for containers and expects that message in "C1"',
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
