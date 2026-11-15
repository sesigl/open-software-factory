import type { WorkItemView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { connectMcp, proving, toolText } from "./server.ts";

scenario("SCN-INTAKE-073", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof proving>>;
  let agent: Awaited<ReturnType<typeof connectMcp>>;
  await given(
    'the server runs with "INTAKE_PERSON_KEYS" set to the key set of the console and "intake mcp" is connected to it as "github:varun"',
    async () => {
      server = await proving(sut, fakes);
      agent = await connectMcp(sut, server.url);
    },
  );

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

  await then(
    '"/v1/work-items/<id>" shows the requester of the kind "trigger" "mcp:github:varun" and the origin "mcp"',
    async () => {
      expect((await server.workItem(view.workItem.id))?.workItem).toMatchObject({
        requester: { kind: "trigger", id: "mcp:github:varun" },
        origin: { source: "mcp" },
        dedupeKey: "mcp:github:varun:Export reports as CSV",
      });
    },
  );
});
