import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { children, runsOf } from "./otlp.ts";

scenario("SCN-RUN-005", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  await when('the developer runs "runlog export session.jsonl"', async () => {
    await sut.cli(["export", "session.jsonl"]);
  });

  await then('"runs.jsonl" has 2 spans "execute_tool Bash" below the root span', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported && children(exported, "execute_tool Bash")).toHaveLength(2);
  });

  await then('the first has "gen_ai.tool.call.id" "toolu_01" and lasts 14 seconds', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    const [first] = exported ? children(exported, "execute_tool Bash") : [];
    expect(first?.attributes).toMatchObject({
      "gen_ai.operation.name": "execute_tool",
      "gen_ai.tool.name": "Bash",
      "gen_ai.tool.call.id": "toolu_01",
    });
    expect(first?.seconds).toBe(14);
  });
});
