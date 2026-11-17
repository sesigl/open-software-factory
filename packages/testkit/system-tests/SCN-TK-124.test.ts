import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { chat } from "./model.ts";

scenario("SCN-TK-124", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('fakes.modelGateway with a reply for a request that contains "Say hello"', async () => {
    gateway = await fakes.modelGateway([{ when: "Say hello", reply: "Hello" }]);
  });

  await when(
    'a module sends "Say hello" to the chat completions endpoint of the gateway with the header "X-Demo-Key" "k1"',
    async () => {
      await chat(gateway, "Say hello", { "X-Demo-Key": "k1" });
    },
  );

  await then('the gateway\'s call has the header "x-demo-key" "k1"', async () => {
    expect(gateway.calls[0]?.headers["x-demo-key"]).toBe("k1");
  });
});
