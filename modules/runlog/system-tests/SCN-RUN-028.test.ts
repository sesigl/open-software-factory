import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-028", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the launcher runs "runlog attach session.jsonl --outcome failed" with TRACEPARENT "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"',
    async () => {
      run = await sut.cli(["attach", "session.jsonl", "--outcome", "failed"], {
        env: { TRACEPARENT: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the root span in "runs.jsonl" has "osf.outcome" "failed"', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    const root = exported?.spans.find((span) => span.name === "invoke_agent");
    expect(root?.attributes["osf.outcome"]).toBe("failed");
  });
});
