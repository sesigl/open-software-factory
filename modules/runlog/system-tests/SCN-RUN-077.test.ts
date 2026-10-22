import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";

scenario("SCN-RUN-077", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the launcher runs "runlog attach session.jsonl" with TRACEPARENT "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01"',
    async () => {
      run = await sut.cli(["attach", "session.jsonl"], {
        env: { TRACEPARENT: "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01" },
      });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "runlog attach needs a W3C TRACEPARENT from the launcher"', async () => {
    expect(run.stderr).toContain("runlog attach needs a W3C TRACEPARENT from the launcher");
  });
});
