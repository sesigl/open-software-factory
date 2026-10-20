import { scenario } from "@opensoftware/testkit";
import { claudeSession } from "./sessions.ts";

scenario("SCN-RUN-021", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository without a commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await sut.files.put("$INPUT/session.jsonl", claudeSession());
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export session.jsonl"', async () => {
    run = await sut.cli(["export", "session.jsonl"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "the run does not match the run-record contract: /resource/osf.factory.version missing required field"',
    async () => {
      expect(run.stderr).toContain(
        "the run does not match the run-record contract: /resource/osf.factory.version missing required field",
      );
    },
  );
});
