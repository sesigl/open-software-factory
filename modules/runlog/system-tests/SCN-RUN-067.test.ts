import { scenario } from "@opensoftware/testkit";
import { children, runsOf } from "./otlp.ts";
import { claudeMillisecondSession } from "./sessions.ts";

scenario("SCN-RUN-067", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and a Claude Code session with a prompt at "2026-01-01T10:00:00.250Z" and an answer at "2026-01-01T10:00:01.750Z"',
    async () => {
      await sut.files.put("$INPUT/session.jsonl", claudeMillisecondSession());
      await sut.git.commit("init");
    },
  );

  await when('the developer runs "runlog export session.jsonl"', async () => {
    await sut.cli(["export", "session.jsonl"]);
  });

  await then(
    'the root span and the "chat claude-sonnet-5-5" span in "runs.jsonl" start at "2026-01-01T10:00:00.250Z" and end at "2026-01-01T10:00:01.750Z"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      const spans = exported ? [exported.root, ...children(exported, "chat claude-sonnet-5-5")] : [];
      expect(spans.map((span) => [span.start, span.end])).toEqual([
        ["2026-01-01T10:00:00.250Z", "2026-01-01T10:00:01.750Z"],
        ["2026-01-01T10:00:00.250Z", "2026-01-01T10:00:01.750Z"],
      ]);
    },
  );
});
