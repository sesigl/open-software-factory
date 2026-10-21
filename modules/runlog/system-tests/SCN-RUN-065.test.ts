import { scenario } from "@opensoftware/testkit";
import { openCodeRepository } from "./given.ts";
import { children, messagesIn, runsOf } from "./otlp.ts";

scenario("SCN-RUN-065", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"',
    async () => {
      await openCodeRepository(sut);
    },
  );

  await when('the developer runs "runlog export session.json --include-content"', async () => {
    await sut.cli(["export", "session.json", "--include-content"]);
  });

  const spans = async (name: string) => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    return exported ? children(exported, name) : [];
  };

  await then(
    'the 2 "chat claude-sonnet-5-5" spans have the input messages [user "Fix the failing login test"] and []',
    async () => {
      const chats = await spans("chat claude-sonnet-5-5");
      expect(chats.map((chat) => messagesIn(chat, "gen_ai.input.messages"))).toEqual([
        [["user", "Fix the failing login test"]],
        [],
      ]);
    },
  );

  await then(
    'they have the output messages [assistant "I will fix the test and run it."] and [assistant "The test passes now."]',
    async () => {
      const chats = await spans("chat claude-sonnet-5-5");
      expect(chats.map((chat) => messagesIn(chat, "gen_ai.output.messages"))).toEqual([
        [["assistant", "I will fix the test and run it."]],
        [["assistant", "The test passes now."]],
      ]);
    },
  );

  await then(
    'the "execute_tool bash" span has the arguments "{\\"command\\":\\"npm test\\"}" and the result "1 passing"',
    async () => {
      const [bash] = await spans("execute_tool bash");
      expect(bash?.attributes).toMatchObject({
        "gen_ai.tool.call.arguments": '{"command":"npm test"}',
        "gen_ai.tool.call.result": "1 passing",
      });
    },
  );

  await then('the "execute_tool read" span, whose call failed, has the result "File not found"', async () => {
    const [read] = await spans("execute_tool read");
    expect(read?.attributes["gen_ai.tool.call.result"]).toBe("File not found");
  });
});
