import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-013", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI posts "hello from demo" to the channel "C1" through the Slack Web API at "DEMO_SLACK_URL"',
    async () => {
      module = demoModule({
        bin: [
          "const response = await fetch(`${process.env.DEMO_SLACK_URL}chat.postMessage`, {",
          '  method: "POST",',
          '  headers: { authorization: `Bearer ${process.env.DEMO_SLACK_TOKEN}`, "content-type": "application/json" },',
          '  body: JSON.stringify({ channel: "C1", text: "hello from demo" }),',
          "});",
          "process.stdout.write(JSON.stringify(await response.json()));",
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
        steps: ['When the user runs "demo"', 'Then "C1" has the message "hello from demo"'],
        test: [
          "const slack = await fakes.slack();",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_SLACK_URL: slack.url, DEMO_SLACK_TOKEN: slack.token } });",
          "});",
          'await then("\\"C1\\" has the message \\"hello from demo\\"", async () => {',
          '  expect(slack.messages("C1").map((message) => message.text)).toContain("hello from demo");',
          "});",
        ],
      });
    },
  );

  await given('its system test passes the URL and token of fakes.slack and expects that message in "C1"', async () => {
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
