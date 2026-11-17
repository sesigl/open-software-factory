import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { events, stream } from "./model.ts";

scenario("SCN-TK-073", async ({ fakes, given, when, then }) => {
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
  await when('a module streams a Responses API call that contains "Say hello" from the gateway', async () => {
    const all = await events(await stream(gateway, "/responses", { input: [{ role: "user", content: "Say hello" }] }));
    const text = all.find((event) => event.type === "response.output_item.done").item.content[0].text;
    const { usage } = all.find((event) => event.type === "response.completed").response;
    output = `${text} ${usage.input_tokens} ${usage.output_tokens}`;
  });

  await then('the text and the token usage are "Hello, Ada 1000 200"', async () => {
    expect(output).toBe("Hello, Ada 1000 200");
  });
});
