import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { chat, json } from "./model.ts";

scenario("SCN-TK-006", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('fakes.modelGateway with the reply "Hello, Ada" for a request that contains "Say hello"', async () => {
    gateway = await fakes.modelGateway([{ when: "Say hello", reply: "Hello, Ada" }]);
  });

  let reply = "";
  await when('a module sends "Say hello" to the chat completions endpoint of the gateway', async () => {
    const response = await chat(gateway, "Say hello");
    const answer = await json(response);
    reply = answer.choices?.[0]?.message?.content ?? `status ${response.status}`;
  });

  await then('the reply is "Hello, Ada"', async () => {
    expect(reply).toBe("Hello, Ada");
  });
});
