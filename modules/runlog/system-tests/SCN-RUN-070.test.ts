import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-070", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  await when('the developer runs "runlog export session.jsonl"', async () => {
    await sut.cli(["export", "session.jsonl"]);
  });

  await then(
    'every span in "runs.jsonl" has the instrumentation scope "@opensoftware/runlog" with a version of the form "<major>.<minor>.<patch>"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.spans.length).toBeGreaterThan(1);
      for (const span of exported?.spans ?? []) expect(span.scope).toMatch(/^@opensoftware\/runlog \d+\.\d+\.\d+$/);
    },
  );
});
