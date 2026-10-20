import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { children, runsOf } from "./otlp.ts";

scenario("SCN-RUN-015", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  await when('the developer runs "runlog export session.jsonl --include-content"', async () => {
    await sut.cli(["export", "session.jsonl", "--include-content"]);
  });

  await then(
    'the first "chat claude-sonnet-5-5" span has "gen_ai.input.messages" with the user text "Fix the failing login test"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      const [first] = exported ? children(exported, "chat claude-sonnet-5-5") : [];
      expect(JSON.parse(String(first?.attributes["gen_ai.input.messages"]))).toEqual([
        { role: "user", parts: [{ type: "text", content: "Fix the failing login test" }] },
      ]);
    },
  );

  await then(
    'the first "execute_tool Bash" span has "gen_ai.tool.call.arguments" "{\\"command\\":\\"npm test\\"}" and "gen_ai.tool.call.result" "1 failing"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      const [first] = exported ? children(exported, "execute_tool Bash") : [];
      expect(first?.attributes).toMatchObject({
        "gen_ai.tool.call.arguments": '{"command":"npm test"}',
        "gen_ai.tool.call.result": "1 failing",
      });
    },
  );
});
