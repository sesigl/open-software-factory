import { scenario } from "@opensoftware/testkit";
import { MCP_RESULT, mcpCall, sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-010", async ({ sut, fakes, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let wiki: Awaited<ReturnType<typeof fakes.http>> | undefined;
    await given('an MCP server "wiki" at "host.docker.internal" that answers every call', async () => {
      wiki = await fakes.http([{ method: "POST", path: "/mcp", body: MCP_RESULT }], { containers: true });
    });

    let id = "";
    await given(
      'a sandbox created from a spec with the test template and the MCP server "wiki" with the tool "search"',
      async () => {
        id = await box.create({
          template: TEMPLATE,
          mcp: [{ name: "wiki", url: `${wiki?.containerUrl}/mcp`, tools: ["search"] }],
        });
      },
    );

    await when('the client calls the tool "search" of the MCP server "wiki" from the sandbox', async () => {
      await box.sh(id, mcpCall(`${wiki?.containerUrl}/mcp`, "search"));
    });

    await then('the MCP server received a call of the tool "search"', async () => {
      expect(wiki?.received()).toMatchObject([
        { method: "POST", path: "/mcp", body: { method: "tools/call", params: { name: "search" } } },
      ]);
    });
  } finally {
    await box.destroyAll();
  }
});
