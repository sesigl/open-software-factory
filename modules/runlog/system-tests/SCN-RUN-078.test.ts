import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

const TRACEPARENT = "00-0af7651916cd43dd8448eb211c803190-b7ad6b7169203330-01";

scenario("SCN-RUN-078", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the launcher runs "runlog attach session.jsonl" with TRACEPARENT "00-0af7651916cd43dd8448eb211c803190-b7ad6b7169203330-01"',
    async () => {
      run = await sut.cli(["attach", "session.jsonl"], { env: { TRACEPARENT } });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('every span in "runs.jsonl" has the trace ID "0af7651916cd43dd8448eb211c803190"', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported?.spans.length).toBeGreaterThan(1);
    for (const span of exported?.spans ?? []) expect(span.traceId).toBe("0af7651916cd43dd8448eb211c803190");
  });

  await then('the root span "invoke_agent" has the parent span ID "b7ad6b7169203330"', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported?.root.parentSpanId).toBe("b7ad6b7169203330");
  });
});
