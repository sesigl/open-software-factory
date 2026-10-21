import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-066", async ({ sut, given, when, then }) => {
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
    'the spans in "runs.jsonl" are "invoke_agent", 3 "chat claude-sonnet-5-5" and 2 "execute_tool Bash", in this order',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.spans.map((span) => span.name)).toEqual([
        "invoke_agent",
        "chat claude-sonnet-5-5",
        "chat claude-sonnet-5-5",
        "chat claude-sonnet-5-5",
        "execute_tool Bash",
        "execute_tool Bash",
      ]);
    },
  );

  await then('the "chat" spans are client spans and the other spans are internal spans', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported?.spans.map((span) => span.kind)).toEqual([
      "internal",
      "client",
      "client",
      "client",
      "internal",
      "internal",
    ]);
  });
});
