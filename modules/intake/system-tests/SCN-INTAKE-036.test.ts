import { scenario } from "@opensoftware/testkit";
import { connectMcp, received, toolText } from "./server.ts";

scenario("SCN-INTAKE-036", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof received>>;
  let agent: Awaited<ReturnType<typeof connectMcp>>;
  await given(
    'the server received the README\'s "work.json" and "intake mcp" is connected to it without "INTAKE_FOREMAN_URL"',
    async () => {
      server = await received(sut, fakes);
      agent = await connectMcp(sut, server.url);
    },
  );

  let result: Awaited<ReturnType<typeof agent.callTool>>;
  await when('the agent calls the tool "run_evidence" with the work item\'s ID', async () => {
    result = await agent.callTool({ name: "run_evidence", arguments: { id: server.id } });
  });

  await then('the tool answers an error that says "set INTAKE_FOREMAN_URL"', async () => {
    expect(result.isError).toBe(true);
    expect(toolText(result)).toBe("set INTAKE_FOREMAN_URL: the base URL of foreman serve, for run_evidence");
  });
});
