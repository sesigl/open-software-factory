import { scenario } from "@opensoftware/testkit";
import { runsOf } from "./otlp.ts";
import { claudeIssueSession } from "./sessions.ts";

scenario("SCN-RUN-026", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and a Claude Code session whose tools printed "https://linear.app/acme/issue/WEB-42/fix-login" and "https://github.com/acme/web/issues/12"',
    async () => {
      await sut.files.put("$INPUT/session.jsonl", claudeIssueSession());
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export session.jsonl"', async () => {
    run = await sut.cli(["export", "session.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the root span in "runs.jsonl" has "osf.issue.urls" ["https://linear.app/acme/issue/WEB-42", "https://github.com/acme/web/issues/12"]',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.root.attributes["osf.issue.urls"]).toEqual([
        "https://linear.app/acme/issue/WEB-42",
        "https://github.com/acme/web/issues/12",
      ]);
    },
  );
});
