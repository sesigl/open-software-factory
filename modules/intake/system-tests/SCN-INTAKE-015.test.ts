import { scenario } from "@opensoftware/testkit";
import { CHANNEL, slackServing } from "./server.ts";

scenario("SCN-INTAKE-015", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackServing>>;
  await given("the server runs with the Slack channel adapter", async () => {
    server = await slackServing(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a mention "<@bot> Export reports as CSV" by "U0PERSON" arrives with a wrong signature', async () => {
    const event = {
      type: "message",
      channel: CHANNEL,
      user: "U0PERSON",
      text: `<@${server.slack.bot}> Export reports as CSV`,
      ts: "1767225600.000001",
    };
    const body = { type: "event_callback", event_id: "Ev1", event };
    answer = await sut.http.request("POST", "/slack/events", {
      body,
      headers: server.slack.sign(JSON.stringify({ ...body, event_id: "Ev2" })),
    });
  });

  await then("the answer has the status 401", async () => {
    expect(answer.status).toBe(401);
  });

  await then('the Slack channel "C0WORK" has no reply', async () => {
    expect(server.slack.messages(CHANNEL)).toEqual([]);
  });
});
