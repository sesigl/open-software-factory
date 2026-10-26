import type { WorkItemView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { connectMcp, serving, toolText } from "./server.ts";

scenario("SCN-INTAKE-017", async ({ sut, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let agent: Awaited<ReturnType<typeof connectMcp>>;
  await given('the server runs and "intake mcp" is connected to it as "github:varun"', async () => {
    server = await serving(sut);
    agent = await connectMcp(sut, server.url);
  });

  let result: Awaited<ReturnType<typeof agent.callTool>>;
  await when('the agent calls the tool "submit_work" with the title "Export reports as CSV"', async () => {
    result = await agent.callTool({ name: "submit_work", arguments: { title: "Export reports as CSV" } });
  });

  let view: WorkItemView;
  await then('the tool answers a work item in the state "received"', async () => {
    expect(result.isError, toolText(result)).toBeFalsy();
    view = JSON.parse(toolText(result)) as WorkItemView;
    expect(view).toMatchObject({ status: "received", workItem: { title: "Export reports as CSV", type: "task" } });
  });

  await then('"/v1/work-items/<id>" shows the requester "github:varun" and the origin "mcp"', async () => {
    expect((await server.workItem(view.workItem.id))?.workItem).toMatchObject({
      requester: { kind: "person", id: "github:varun" },
      origin: { source: "mcp" },
      dedupeKey: "mcp:github:varun:Export reports as CSV",
    });
  });
});
