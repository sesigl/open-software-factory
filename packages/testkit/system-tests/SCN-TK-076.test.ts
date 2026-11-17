import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { events, stream } from "./model.ts";

scenario("SCN-TK-076", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'fakes.modelGateway with the tool "edit" with the input "{"filePath":"notes.md"}" and 1000 prompt tokens and 200 completion tokens for a request that contains "fix the typo"',
    async () => {
      gateway = await fakes.modelGateway([
        {
          when: "fix the typo",
          reply: "",
          tools: [{ name: "edit", input: { filePath: "notes.md" } }],
          usage: { prompt_tokens: 1000, completion_tokens: 200 },
        },
      ]);
    },
  );

  let output = "";
  await when('a module streams a chat completions call that contains "fix the typo" from the gateway', async () => {
    const messages = [{ role: "user", content: "fix the typo" }];
    const all = await events(await stream(gateway, "/chat/completions", { messages }));
    const choices = all.flatMap((event) => event.choices);
    const call = choices.find((choice) => choice.delta.tool_calls).delta.tool_calls[0];
    const finish = choices.find((choice) => choice.finish_reason).finish_reason;
    const { usage } = all.find((event) => event.usage);
    output = `${call.function.name} ${call.function.arguments} ${finish} ${usage.prompt_tokens} ${usage.completion_tokens}`;
  });

  await then(
    'the tool call, the finish reason and the token usage are "edit {"filePath":"notes.md"} tool_calls 1000 200"',
    async () => {
      expect(output).toBe('edit {"filePath":"notes.md"} tool_calls 1000 200');
    },
  );
});
