import { scenario } from "@opensoftware/testkit";
import { MCP_RESULT, mcpCall, sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-011", async ({ sut, fakes, given, when, then }) => {
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

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when('the client calls the tool "delete_page" of the MCP server "wiki" from the sandbox', async () => {
      run = await box.sh(id, mcpCall(`${wiki?.containerUrl}/mcp`, "delete_page"));
    });

    await then("the call gets a JSON-RPC error", async () => {
      expect(run.stdout, run.stderr).toMatch(/"error":\{"code":-32001/);
    });

    await then("the MCP server received no request", async () => {
      expect(wiki?.requests()).toEqual([]);
    });

    await then('the egress log holds a call of the tool "delete_page" of "wiki" refused by "mcp"', async () => {
      expect(await box.egressLog(id)).toContainEqual(
        expect.objectContaining({ mcpServer: "wiki", tool: "delete_page", outcome: "refused", refusedBy: "mcp" }),
      );
    });
  } finally {
    await box.destroyAll();
  }
});
