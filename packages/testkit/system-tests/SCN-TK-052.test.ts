import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";
import { SIGNED_README, SIGNED_SERVER } from "./slack-server.ts";

scenario("SCN-TK-052", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose server checks the Slack signature with "DEMO_SLACK_SIGNING_SECRET" and keeps the text of each "message" event',
    async () => {
      module = demoModule({
        bin: SIGNED_SERVER.join("\n"),
        readme: SIGNED_README,
        steps: ['When a person says "approve" in "C1"', 'Then the server has "approve"'],
        test: [
          "const slack = await fakes.slack();",
          "const url = await sut.http.start([], { env: { DEMO_SLACK_SIGNING_SECRET: slack.signingSecret } });",
          "slack.deliverTo(`${url}/events`);",
          'await when(\'a person says "approve" in "C1"\', async () => {',
          '  await slack.say({ channel: "C1", text: "approve" });',
          "});",
          "await then('the server has \"approve\"', async () => {",
          '  expect((await sut.http.get("/kept")).body).toEqual(["approve"]);',
          "});",
        ],
      });
    },
  );

  await given(
    'its system test passes the signing secret of fakes.slack, says "approve" in "C1" and expects the server to have "approve"',
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
