import { scenario } from "@opensoftware/testkit";
import { CHANNEL, eventually, forgeEnv, githubTo, slackServing } from "./server.ts";

scenario("SCN-INTAKE-024", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackServing>>;
  let issue: { url: string };
  let id = "";
  await given('the server made a work item of the GitHub issue "Export reports as CSV" labeled "factory"', async () => {
    server = await slackServing(sut, fakes, forgeEnv(sut));
    issue = await (await githubTo(fakes, `${server.url}/forge/events`)).labeled("factory");
    id = (await eventually(server, issue.url)).workItem.id;
  });

  let ts = "";
  await when('"U0PERSON" says "<@bot> please take <the issue\'s link>" in the Slack channel "C0WORK"', async () => {
    ts = (await server.slack.say({ channel: CHANNEL, text: `<@${server.slack.bot}> please take <${issue.url}>` })).ts;
  });

  await then('the thread has the reply "Added to work item <id>."', async () => {
    expect(server.replies()).toEqual([expect.objectContaining({ threadTs: ts, text: `Added to work item ${id}.` })]);
  });

  await then('"/v1/work-items/<id>" lists the requests from "github" and "slack"', async () => {
    const view = await server.workItem(id);
    expect(view?.requests.map((request) => request.origin.source)).toEqual(["github", "slack"]);
    expect(view?.workItem.title).toBe("Export reports as CSV");
  });
});
