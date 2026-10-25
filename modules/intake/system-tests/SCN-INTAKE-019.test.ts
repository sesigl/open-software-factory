import { scenario } from "@opensoftware/testkit";
import { connectMcp, serving, toolText } from "./server.ts";

scenario("SCN-INTAKE-019", async ({ sut, given, when, then }) => {
  let agent: Awaited<ReturnType<typeof connectMcp>>;
  await given('the server runs and "intake mcp" is connected to it with a wrong API token', async () => {
    const server = await serving(sut);
    agent = await connectMcp(sut, server.url, "not-the-token");
  });

  let result: Awaited<ReturnType<typeof agent.callTool>>;
  await when('the agent calls the tool "submit_work" with the title "Export reports as CSV"', async () => {
    result = await agent.callTool({ name: "submit_work", arguments: { title: "Export reports as CSV" } });
  });

  await then('the tool answers an error that says "the intake server answered 401"', async () => {
    expect(result.isError).toBe(true);
    expect(toolText(result)).toBe("the intake server answered 401: send Authorization: Bearer <INTAKE_API_TOKEN>");
  });
});
