import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { chat, json } from "./model.ts";

scenario("SCN-TK-042", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'fakes.modelGateway with the reply "Hello, Ada" with 1000 prompt tokens and 200 completion tokens for a request that contains "Say hello"',
    async () => {
      gateway = await fakes.modelGateway([
        { when: "Say hello", reply: "Hello, Ada", usage: { prompt_tokens: 1000, completion_tokens: 200 } },
      ]);
    },
  );

  let output = "";
  await when('a module sends "Say hello" to the chat completions endpoint of the gateway', async () => {
    const { usage } = await json(chat(gateway, "Say hello"));
    output = `${usage.prompt_tokens} ${usage.completion_tokens} ${usage.total_tokens}`;
  });

  await then("the reported token usage is 1000 prompt, 200 completion and 1200 total tokens", async () => {
    expect(output).toBe("1000 200 1200");
  });
});
