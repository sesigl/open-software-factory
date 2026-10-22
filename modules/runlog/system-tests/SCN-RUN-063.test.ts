import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { children, messagesIn, runsOf } from "./otlp.ts";

scenario("SCN-RUN-063", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  await when('the developer runs "runlog export session.jsonl --include-content"', async () => {
    await sut.cli(["export", "session.jsonl", "--include-content"]);
  });

  const spans = async (name: string) => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    return exported ? children(exported, name) : [];
  };

  await then(
    'the 3 "chat claude-sonnet-5-5" spans have the input messages [user "Fix the failing login test"], [] and []',
    async () => {
      const chats = await spans("chat claude-sonnet-5-5");
      expect(chats.map((chat) => messagesIn(chat, "gen_ai.input.messages"))).toEqual([
        [["user", "Fix the failing login test"]],
        [],
        [],
      ]);
    },
  );

  await then(
    'they have the output messages [assistant "I will run the tests."], [] and [assistant "Opened the pull request."]',
    async () => {
      const chats = await spans("chat claude-sonnet-5-5");
      expect(chats.map((chat) => messagesIn(chat, "gen_ai.output.messages"))).toEqual([
        [["assistant", "I will run the tests."]],
        [],
        [["assistant", "Opened the pull request."]],
      ]);
    },
  );

  await then(
    'the 2 "execute_tool Bash" spans have the arguments "{\\"command\\":\\"npm test\\"}" and "{\\"command\\":\\"gh pr create --fill\\"}"',
    async () => {
      const calls = await spans("execute_tool Bash");
      expect(calls.map((call) => call.attributes["gen_ai.tool.call.arguments"])).toEqual([
        '{"command":"npm test"}',
        '{"command":"gh pr create --fill"}',
      ]);
    },
  );

  await then(
    'they have the results "1 failing" and "https://github.com/acme/web/pull/7" with its line break',
    async () => {
      const calls = await spans("execute_tool Bash");
      expect(calls.map((call) => call.attributes["gen_ai.tool.call.result"])).toEqual([
        "1 failing",
        "https://github.com/acme/web/pull/7\n",
      ]);
    },
  );
});
