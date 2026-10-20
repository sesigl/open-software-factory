import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { children, runsOf } from "./otlp.ts";

scenario("SCN-RUN-004", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  await when('the developer runs "runlog export session.jsonl"', async () => {
    await sut.cli(["export", "session.jsonl"]);
  });

  await then('"runs.jsonl" has 3 spans "chat claude-sonnet-5-5" below the root span', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported && children(exported, "chat claude-sonnet-5-5")).toHaveLength(3);
  });

  await then(
    'the first has "gen_ai.response.id" "msg_01", "gen_ai.usage.input_tokens" 1500 and "gen_ai.usage.output_tokens" 50',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      const [first] = exported ? children(exported, "chat claude-sonnet-5-5") : [];
      expect(first?.attributes).toMatchObject({
        "gen_ai.operation.name": "chat",
        "gen_ai.response.id": "msg_01",
        "gen_ai.usage.input_tokens": 1500,
        "gen_ai.usage.output_tokens": 50,
      });
    },
  );
});
