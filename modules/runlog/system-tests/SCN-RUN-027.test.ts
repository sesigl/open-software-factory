import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-027", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the launcher runs "runlog attach session.jsonl" with TRACEPARENT "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"',
    async () => {
      run = await sut.cli(["attach", "session.jsonl"], {
        env: { TRACEPARENT: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('every span in "runs.jsonl" has the trace ID "4bf92f3577b34da6a3ce929d0e0e4736"', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported?.spans.length).toBeGreaterThan(1);
    for (const span of exported?.spans ?? []) expect(span.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  await then('the root span "invoke_agent" has the parent span ID "00f067aa0ba902b7"', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    const root = exported?.spans.find((span) => span.name === "invoke_agent");
    expect(root?.parentSpanId).toBe("00f067aa0ba902b7");
  });
});
