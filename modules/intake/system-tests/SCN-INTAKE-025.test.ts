import { scenario } from "@opensoftware/testkit";
import { CHANNEL, forgeEnv, githubTo, slackServing } from "./server.ts";

scenario("SCN-INTAKE-025", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof slackServing>>;
  let github: Awaited<ReturnType<typeof githubTo>>;
  let issue: { number: number; url: string };
  await given(
    'the server made a work item of the mention "<@bot> please take <the issue\'s link>" in the Slack channel "C0WORK"',
    async () => {
      server = await slackServing(sut, fakes, forgeEnv(sut));
      github = await githubTo(fakes, `${server.url}/forge/events`);
      const opened = await github.github.openIssue("web", { title: "Export reports as CSV" });
      issue = { number: opened.number, url: opened.url };
      await server.slack.say({ channel: CHANNEL, text: `<@${server.slack.bot}> please take <${issue.url}>` });
    },
  );

  await when('"tester" adds the label "factory" to the issue', async () => {
    await github.labeled("factory", issue.number);
  });

  await then('"/v1/work-items/<id>" lists the requests from "slack" and "github"', async () => {
    const sources = async () => (await server.byKey(issue.url)).view?.requests.map((request) => request.origin.source);
    await expect.poll(sources, { timeout: 10_000, interval: 50 }).toEqual(["slack", "github"]);
  });

  await then('the thread has one reply, "Received as work item <id>."', async () => {
    const id = (await server.byKey(issue.url)).view?.workItem.id;
    expect(server.replies().map((reply) => reply.text)).toEqual([`Received as work item ${id}.`]);
  });
});
