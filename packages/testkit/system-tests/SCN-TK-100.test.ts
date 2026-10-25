import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-100", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI posts "first" and "second" to "C1", replies "in thread" to "first" and prints the texts of "conversations.history"',
    async () => {
      module = demoModule({
        bin: [
          "const call = async (method, body) => {",
          "  const response = await fetch(`${process.env.DEMO_SLACK_URL}${method}`, {",
          '    method: "POST",',
          '    headers: { authorization: `Bearer ${process.env.DEMO_SLACK_TOKEN}`, "content-type": "application/json" },',
          "    body: JSON.stringify(body),",
          "  });",
          "  return response.json();",
          "};",
          'const first = await call("chat.postMessage", { channel: "C1", text: "first" });',
          'await call("chat.postMessage", { channel: "C1", text: "second" });',
          'await call("chat.postMessage", { channel: "C1", text: "in thread", thread_ts: first.ts });',
          'const { messages } = await call("conversations.history", { channel: "C1" });',
          'process.stdout.write(messages.map((message) => message.text).join(" "));',
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
        steps: ['When the user runs "demo"', 'Then the output is "second first"'],
        test: [
          "const slack = await fakes.slack();",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_SLACK_URL: slack.url, DEMO_SLACK_TOKEN: slack.token } });",
          "});",
          "await then('the output is \"second first\"', async () => {",
          '  expect(run.stdout).toBe("second first");',
          "});",
        ],
      });
    },
  );

  await given('its system test expects "second first"', async () => {
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
