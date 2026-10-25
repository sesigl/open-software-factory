import { scenario } from "@opensoftware/testkit";
import { CHANNEL, slackServing } from "./server.ts";

scenario("SCN-INTAKE-014", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackServing>>;
  let ts = "";
  await given(
    'the server made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"',
    async () => {
      server = await slackServing(sut, fakes);
      ts = (await server.slack.say({ channel: CHANNEL, text: `<@${server.slack.bot}> Export reports as CSV` })).ts;
    },
  );

  await when('"U0PERSON" says "<@bot> also as Excel" in the thread', async () => {
    await server.slack.say({ channel: CHANNEL, text: `<@${server.slack.bot}> also as Excel`, threadTs: ts });
  });

  await then('the thread has one reply, "Received as work item <id>."', async () => {
    const replies = server.replies();
    expect(replies.map((reply) => reply.text)).toEqual([expect.stringMatching(/^Received as work item wi_/)]);
    const id = /wi_[0-9a-f]{20}/.exec(replies[0]?.text ?? "")?.[0] as string;
    expect((await server.workItem(id))?.requests).toHaveLength(2);
  });
});
