import { scenario } from "@opensoftware/testkit";
import { connectMcp, serving } from "./server.ts";

scenario("SCN-INTAKE-037", async ({ sut, given, when, then }) => {
  let agent: Awaited<ReturnType<typeof connectMcp>>;
  await given('the server runs and "intake mcp" is connected to it as "github:varun"', async () => {
    agent = await connectMcp(sut, (await serving(sut)).url);
  });

  let tools: Awaited<ReturnType<typeof agent.listTools>>["tools"] = [];
  await when("the agent lists the tools", async () => {
    tools = (await agent.listTools()).tools;
  });

  await then(
    'the tools are "submit_work", "work_status" and "run_evidence", which takes the work item\'s "id"',
    async () => {
      expect(tools.map((tool) => tool.name)).toEqual(["submit_work", "work_status", "run_evidence"]);
      expect(tools[2]).toEqual({
        name: "run_evidence",
        description:
          "What the foreman recorded of a work item's run: its state, factory version, pull request, and each stage " +
          "with its agent, state, harness session, gate, checks and reason.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", description: "The work item's ID, like wi_…" } },
          required: ["id"],
        },
      });
    },
  );
});
