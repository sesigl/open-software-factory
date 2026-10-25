import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-024", async ({ sut, fakes, given, when, then }) => {
  const { slack, env } = await slackEnv(sut, fakes);
  await given("the README policy, groups and request", async () => {
    await putReadme(sut, fakes);
  });

  await given('"slack:U0EVE" posted the request\'s marker text in the Slack channel "C0GATES"', async () => {
    // gatekeeper's own request in another channel gives the text, marker included.
    const other = GATE.map((arg) => (arg === "slack:C0GATES" ? "slack:C0OTHER" : arg));
    expect((await sut.cli(["request", ...other], { env })).exitCode).toBe(0);
    const text = slack.messages("C0OTHER")[0]?.text ?? "";
    expect(text).toMatch(/\[gatekeeper g[0-9a-f]{16} requested\]$/);
    await slack.say({ channel: "C0GATES", text, user: "U0EVE" });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["status", ...GATE], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error output says that "slack:C0GATES" has no request for the gate and to run "gatekeeper request" first',
    async () => {
      expect(run.stderr).toMatch(
        /slack:C0GATES has no request for the gate g[0-9a-f]{16}: run "gatekeeper request" first/,
      );
    },
  );
});
