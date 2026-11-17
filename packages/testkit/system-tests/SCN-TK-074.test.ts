import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { events, stream } from "./model.ts";

scenario("SCN-TK-074", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'fakes.modelGateway with the tool "exec_command" with the input "{"cmd":"cat notes.md"}" and the tool "apply_patch" with the text input "*** Begin Patch" for a request that contains "fix the typo"',
    async () => {
      gateway = await fakes.modelGateway([
        {
          when: "fix the typo",
          reply: "",
          tools: [
            { name: "exec_command", input: { cmd: "cat notes.md" } },
            { name: "apply_patch", input: "*** Begin Patch" },
          ],
        },
      ]);
    },
  );

  let items: string[] = [];
  await when('a module streams a Responses API call that contains "fix the typo" from the gateway', async () => {
    const all = await events(
      await stream(gateway, "/responses", { input: [{ role: "user", content: "fix the typo" }] }),
    );
    items = all
      .filter((event) => event.type === "response.output_item.done")
      .map(({ item }) => `${item.type} ${item.name} ${item.arguments ?? item.input}`);
  });

  await then(
    'the output items are "function_call exec_command {"cmd":"cat notes.md"}" and "custom_tool_call apply_patch *** Begin Patch"',
    async () => {
      expect(items).toEqual([
        'function_call exec_command {"cmd":"cat notes.md"}',
        "custom_tool_call apply_patch *** Begin Patch",
      ]);
    },
  );
});
