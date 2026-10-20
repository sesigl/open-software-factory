import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-007", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  await given('the developer ran "runlog export session.jsonl"', async () => {
    await sut.cli(["export", "session.jsonl"]);
  });

  await when('the developer runs "runlog export session.jsonl" again', async () => {
    await sut.cli(["export", "session.jsonl"]);
  });

  await then('"runs.jsonl" has 2 lines with the same trace ID', async () => {
    const runs = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(runs).toHaveLength(2);
    expect(runs[1]?.root.traceId).toBe(runs[0]?.root.traceId);
  });
});
