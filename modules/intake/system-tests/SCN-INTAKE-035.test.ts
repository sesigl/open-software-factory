import { scenario } from "@opensoftware/testkit";
import { connectMcp, foremanWith, received, toolText } from "./server.ts";

scenario("SCN-INTAKE-035", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof received>>;
  let foreman: Awaited<ReturnType<typeof foremanWith>>;
  let agent: Awaited<ReturnType<typeof connectMcp>>;
  await given(
    'the server received the README\'s "work.json" and "intake mcp" is connected to it with a foreman',
    async () => {
      server = await received(sut, fakes);
      foreman = await foremanWith(fakes, (await server.workItem(server.id))?.workItem as never);
      agent = await connectMcp(sut, server.url, undefined, foreman.env);
    },
  );

  let result: Awaited<ReturnType<typeof agent.callTool>>;
  await when('the agent calls the tool "run_evidence" with the work item\'s ID', async () => {
    result = await agent.callTool({ name: "run_evidence", arguments: { id: server.id } });
  });

  await then('the tool answers an error that says "has no run yet"', async () => {
    expect(result.isError).toBe(true);
    expect(toolText(result)).toBe(`work item ${server.id} has no run yet`);
    expect(foreman.requests()).toEqual([]);
  });
});
