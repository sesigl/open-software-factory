import { egressEntries } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SEGRESS-010", async ({ given, when, then }) => {
  let log = "";
  await given(
    'an iron-proxy audit line of a call of the tool "delete_page" of "wiki" that the MCP policy denied',
    async () => {
      log = JSON.stringify({
        msg: "request",
        audit: { host: "wiki.example.com", method: "POST", path: "/mcp", action: "allow" },
        mcp: {
          server: "wiki",
          messages: [
            { direction: "response", tool: "search" },
            { direction: "request", tool: "delete_page", decision: "deny" },
          ],
        },
      });
    },
  );

  let entries: ReturnType<typeof egressEntries> = [];
  await when("the adapter calls egressEntries with the log", async () => {
    entries = egressEntries(log);
  });

  await then('the entry is a call of the tool "delete_page" of "wiki" refused by "mcp"', async () => {
    expect(entries).toEqual([
      {
        host: "wiki.example.com",
        method: "POST",
        path: "/mcp",
        outcome: "allowed",
        refusedBy: "mcp",
        mcpServer: "wiki",
        tool: "delete_page",
      },
    ]);
  });
});
