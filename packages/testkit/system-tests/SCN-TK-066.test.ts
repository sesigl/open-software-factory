import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { events, messages } from "./model.ts";

scenario("SCN-TK-066", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'fakes.modelGateway with the tool call "Write" with the input "{"file_path":"notes.md"}" for a request that contains "fix the typo"',
    async () => {
      gateway = await fakes.modelGateway([
        { when: "fix the typo", reply: "", tools: [{ name: "Write", input: { file_path: "notes.md" } }] },
      ]);
    },
  );

  let output = "";
  await when('a module streams a Messages API call that contains "fix the typo" from the gateway', async () => {
    const all = await events(await messages(gateway, "fix the typo", { stream: true }));
    const name = all.find((event) => event.content_block?.type === "tool_use").content_block.name;
    const input = all.find((event) => event.delta?.type === "input_json_delta").delta.partial_json;
    const stop = all.find((event) => event.type === "message_delta").delta.stop_reason;
    output = `${name} ${input} ${stop}`;
  });

  await then('the tool call and the stop reason are "Write {"file_path":"notes.md"} tool_use"', async () => {
    expect(output).toBe('Write {"file_path":"notes.md"} tool_use');
  });
});
