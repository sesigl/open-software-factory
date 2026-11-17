import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { json, messages } from "./model.ts";

scenario("SCN-TK-065", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('fakes.modelGateway with the reply "Hello, Ada" for a request that contains "Say hello"', async () => {
    gateway = await fakes.modelGateway([{ when: "Say hello", reply: "Hello, Ada" }]);
  });

  let output = "";
  await when('a module sends "Say hello" to the Anthropic Messages endpoint of the gateway', async () => {
    const { content, stop_reason } = await json(messages(gateway, "Say hello"));
    output = `${content[0].text} ${stop_reason}`;
  });

  await then('the text and the stop reason are "Hello, Ada end_turn"', async () => {
    expect(output).toBe("Hello, Ada end_turn");
  });
});
