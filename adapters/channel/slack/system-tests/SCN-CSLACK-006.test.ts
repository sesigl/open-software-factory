import { scenario } from "@opensoftware/testkit";

scenario("SCN-CSLACK-006", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "--help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then(
    'the help exits with code 0 and names a thread as "slack:<channel>:<ts>", a channel as "slack:<channel>" and Slack\'s Web API',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(run.stdout).toContain(
        "A thread is slack:<channel>:<ts>. A channel, slack:<channel>, takes the place of a thread: reply and ask start a new thread, messages lists its newest messages. CHANNEL_API_URL is Slack's Web API, by default https://slack.com/api/.\n",
      );
    },
  );
});
