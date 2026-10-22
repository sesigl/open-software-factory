import { scenario } from "@opensoftware/testkit";
import { codexRepository } from "./given.ts";
import { children, messagesIn, runsOf } from "./otlp.ts";
import { ADD_SESSION_PATCH } from "./sessions.ts";

scenario("SCN-RUN-064", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"',
    async () => {
      await codexRepository(sut);
    },
  );

  await when('the developer runs "runlog export rollout.jsonl --include-content"', async () => {
    await sut.cli(["export", "rollout.jsonl", "--include-content"]);
  });

  const spans = async (name: string) => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    return exported ? children(exported, name) : [];
  };

  await then(
    'the 2 "chat gpt-5-codex" spans have the input messages [user "Fix the failing login test"] and []',
    async () => {
      const chats = await spans("chat gpt-5-codex");
      expect(chats.map((chat) => messagesIn(chat, "gen_ai.input.messages"))).toEqual([
        [["user", "Fix the failing login test"]],
        [],
      ]);
    },
  );

  await then('they have the output messages [] and [assistant "Fixed the test."]', async () => {
    const chats = await spans("chat gpt-5-codex");
    expect(chats.map((chat) => messagesIn(chat, "gen_ai.output.messages"))).toEqual([
      [],
      [["assistant", "Fixed the test."]],
    ]);
  });

  await then(
    'the "execute_tool shell" span has the arguments "{\\"command\\":[\\"npm\\",\\"test\\"]}" and the result "1 failing"',
    async () => {
      const [shell] = await spans("execute_tool shell");
      expect(shell?.attributes).toMatchObject({
        "gen_ai.tool.call.arguments": '{"command":["npm","test"]}',
        "gen_ai.tool.call.result": "1 failing",
      });
    },
  );

  await then(
    'the "execute_tool apply_patch" span has the patch that adds "src/session.ts" as its arguments and the result "Success."',
    async () => {
      const [patch] = await spans("execute_tool apply_patch");
      expect(patch?.attributes).toMatchObject({
        "gen_ai.tool.call.arguments": ADD_SESSION_PATCH,
        "gen_ai.tool.call.result": "Success.",
      });
    },
  );
});
