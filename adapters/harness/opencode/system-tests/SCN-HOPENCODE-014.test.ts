import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { chatCalls, connect } from "./opencode.ts";

scenario("SCN-HOPENCODE-014", async ({ sut, fakes, given, when, then }) => {
  await given('the working folder has "notes.md" with "a typo"', async () => {
    await sut.files.put("$INPUT/notes.md", "a typo\n");
  });

  let gateway: ModelGateway;
  await given(
    'a model gateway scripted to call "read", "glob", "grep" and "todowrite" when the prompt says "look around"',
    async () => {
      const tools = [
        { name: "read", input: { filePath: sut.files.path("$INPUT/notes.md") } },
        { name: "glob", input: { pattern: "*.md" } },
        { name: "grep", input: { pattern: "typo" } },
        { name: "todowrite", input: { todos: [{ content: "fix the typo", status: "pending", priority: "high" }] } },
      ];
      gateway = await fakes.modelGateway([
        { when: "look around", reply: "", tools },
        { when: "look around", reply: "done" },
      ]);
    },
  );

  let client: AcpClient;
  await given("the adapter runs opencode with that gateway", async () => {
    client = await connect(sut, gateway);
  });

  await when('the client sends the prompt "look around"', async () => {
    await (await client.newSession()).prompt("look around");
  });

  await then(
    "the client was not asked to approve a tool call and opencode sent the model the result of each of the 4 tool calls",
    async () => {
      expect(client.permissionRequests()).toEqual([]);
      const results =
        chatCalls(gateway)
          .at(-1)
          ?.messages?.filter((message) => message.role === "tool") ?? [];
      expect(results).toHaveLength(4);
    },
  );
});
