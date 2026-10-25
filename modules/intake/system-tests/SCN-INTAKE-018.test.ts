import { scenario } from "@opensoftware/testkit";
import { connectMcp, received, toolText } from "./server.ts";

scenario("SCN-INTAKE-018", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof received>>;
  let agent: Awaited<ReturnType<typeof connectMcp>>;
  await given(
    'the server received the README\'s "work.json" and "intake mcp" is connected to it as "github:varun"',
    async () => {
      server = await received(sut, fakes);
      agent = await connectMcp(sut, server.url);
    },
  );

  let result: Awaited<ReturnType<typeof agent.callTool>>;
  await when('the agent calls the tool "work_status" with the work item\'s ID', async () => {
    result = await agent.callTool({ name: "work_status", arguments: { id: server.id } });
  });

  await then(
    'the tool answers the work item with the title "Export reports as CSV" in the state "received"',
    async () => {
      expect(result.isError, toolText(result)).toBeFalsy();
      expect(JSON.parse(toolText(result))).toMatchObject({
        status: "received",
        workItem: { id: server.id, title: "Export reports as CSV" },
      });
    },
  );
});
