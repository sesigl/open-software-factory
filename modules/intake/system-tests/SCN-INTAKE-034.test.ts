import { scenario } from "@opensoftware/testkit";
import { connectMcp, FOREMAN_TOKEN, following, foremanWith, RUN, runEvent, toolText } from "./server.ts";

scenario("SCN-INTAKE-034", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given('the server knows the run "run_5d41402abc4b2a76b971" of the README\'s "work.json"', async () => {
    server = await following(sut, fakes);
    await server.publish(runEvent(server.id));
    await server.until("running");
  });

  let foreman: Awaited<ReturnType<typeof foremanWith>>;
  let agent: Awaited<ReturnType<typeof connectMcp>>;
  await given(
    '"intake mcp" is connected to it with "INTAKE_FOREMAN_URL" set to a foreman that has that run',
    async () => {
      foreman = await foremanWith(fakes, (await server.workItem(server.id))?.workItem as never);
      agent = await connectMcp(sut, server.url, undefined, foreman.env);
    },
  );

  let result: Awaited<ReturnType<typeof agent.callTool>>;
  await when('the agent calls the tool "run_evidence" with the work item\'s ID', async () => {
    result = await agent.callTool({ name: "run_evidence", arguments: { id: server.id } });
  });

  await then("the tool answers the run with its state, factory version, pull request and stages", async () => {
    expect(result.isError, toolText(result)).toBeFalsy();
    expect(JSON.parse(toolText(result))).toEqual(foreman.run);
    expect(foreman.headers()).toMatchObject([
      { method: "GET", path: `/v1/runs/${RUN}`, headers: { authorization: `Bearer ${FOREMAN_TOKEN}` } },
    ]);
  });
});
