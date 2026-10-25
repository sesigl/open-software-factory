import { scenario } from "@opensoftware/testkit";
import { CHANNEL, slackServing } from "./server.ts";

scenario("SCN-INTAKE-013", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackServing>>;
  await given("the server runs with the Slack channel adapter", async () => {
    server = await slackServing(sut, fakes);
  });

  let ts = "";
  await when('"U0PERSON" says "<@bot> Export reports as CSV" in the Slack channel "C0WORK"', async () => {
    ts = (await server.slack.say({ channel: CHANNEL, text: `<@${server.slack.bot}> Export reports as CSV` })).ts;
  });

  let id = "";
  await then('the thread has the reply "Received as work item <id>."', async () => {
    const [reply] = server.replies();
    expect(reply).toMatchObject({
      threadTs: ts,
      text: expect.stringMatching(/^Received as work item wi_[0-9a-f]{20}\.$/),
    });
    id = /wi_[0-9a-f]{20}/.exec(reply?.text ?? "")?.[0] as string;
  });

  await then(
    '"/v1/work-items/<id>" shows the requester "slack:U0PERSON" named "Varun" and a link to the message',
    async () => {
      const view = await server.workItem(id);
      expect(view?.workItem).toMatchObject({
        title: "Export reports as CSV",
        requester: { kind: "person", id: "slack:U0PERSON", displayName: "Varun" },
        origin: { source: "slack", url: `https://testkit.slack.com/archives/${CHANNEL}/p${ts.replace(".", "")}` },
        dedupeKey: `slack:${CHANNEL}:${ts}`,
      });
    },
  );
});
