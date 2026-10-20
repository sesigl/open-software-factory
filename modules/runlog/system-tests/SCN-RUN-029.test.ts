import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";

scenario("SCN-RUN-029", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the launcher runs "runlog attach session.jsonl" with TRACEPARENT "not-a-trace"', async () => {
    run = await sut.cli(["attach", "session.jsonl"], { env: { TRACEPARENT: "not-a-trace" } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "runlog attach needs a W3C TRACEPARENT from the launcher"', async () => {
    expect(run.stderr).toContain("runlog attach needs a W3C TRACEPARENT from the launcher");
  });

  await then('the output folder has no "runs.jsonl"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("runs.jsonl");
  });
});
