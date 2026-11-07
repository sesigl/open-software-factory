import { scenario } from "@opensoftware/testkit";

scenario("SCN-CGITHUB-002", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "--help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then(
    'the help exits with code 0 and names a thread as "github:<owner>/<repo>:<number>" and GitHub\'s REST API',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(run.stdout).toContain(
        "A thread is github:<owner>/<repo>:<number>. CHANNEL_API_URL is GitHub's REST API, by default https://api.github.com.\n",
      );
    },
  );
});
