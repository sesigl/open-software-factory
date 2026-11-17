import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { json, messages } from "./model.ts";

scenario("SCN-TK-069", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'fakes.modelGateway with the stop reason "refusal" with 1000 prompt tokens and 200 completion tokens for a request that contains "Say hello"',
    async () => {
      gateway = await fakes.modelGateway([
        { when: "Say hello", reply: "", stopReason: "refusal", usage: { prompt_tokens: 1000, completion_tokens: 200 } },
      ]);
    },
  );

  let output = "";
  await when('a module sends "Say hello" to the Anthropic Messages endpoint of the gateway', async () => {
    const { stop_reason, usage } = await json(messages(gateway, "Say hello"));
    output = `${stop_reason} ${usage.input_tokens} ${usage.output_tokens}`;
  });

  await then('the stop reason and the token usage are "refusal 1000 200"', async () => {
    expect(output).toBe("refusal 1000 200");
  });
});
