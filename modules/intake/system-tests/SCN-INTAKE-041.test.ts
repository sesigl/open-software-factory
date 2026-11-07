import { scenario } from "@opensoftware/testkit";
import { connectMcp, serving } from "./server.ts";

scenario("SCN-INTAKE-041", async ({ sut, given, when, then }) => {
  let agent: Awaited<ReturnType<typeof connectMcp>>;
  await given('the server runs and "intake mcp" is connected to it as "github:varun"', async () => {
    agent = await connectMcp(sut, (await serving(sut)).url);
  });

  let tools: Awaited<ReturnType<typeof agent.listTools>>["tools"] = [];
  await when("the agent lists the tools", async () => {
    tools = (await agent.listTools()).tools;
  });

  await then(
    'the tool "submit_work" takes the "title", and optional "description", "type" and "dedupeKey", each with its description',
    async () => {
      expect(tools[0]).toEqual({
        name: "submit_work",
        description:
          "Put work into the factory's inbox. Work with the same dedupe key is one work item. Answers the work item.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "What should be done, in one line." },
            description: { type: "string", description: "Details for the agents that do the work." },
            type: { type: "string", enum: ["idea", "bug", "task", "automation"], description: "Default: task." },
            dedupeKey: { type: "string", description: "Default: mcp:<requester>:<title>." },
          },
          required: ["title"],
        },
      });
    },
  );

  await then('the tool "work_status" takes the work item\'s "id"', async () => {
    expect(tools[1]).toEqual({
      name: "work_status",
      description: "The state of a work item and every request that asked for it.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "The work item's ID, like wi_…" } },
        required: ["id"],
      },
    });
  });
});
