import { scenario } from "@opensoftware/testkit";
import { mcpCall, sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-009", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given(
      'a sandbox created from a spec with the test template and the MCP server "wiki" with the tool "search"',
      async () => {
        const wiki = { name: "wiki", url: "http://host.docker.internal:8000/mcp", tools: ["search"] };
        id = await box.create({ template: TEMPLATE, mcp: [wiki] });
      },
    );

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when(
      'the client calls the tool "create_issue" of "http://tracker.example.invalid/mcp" from the sandbox',
      async () => {
        run = await box.sh(id, mcpCall("http://tracker.example.invalid/mcp", "create_issue"));
      },
    );

    await then("the request gets the status 403", async () => {
      expect(run.stdout, run.stderr).toMatch(/ 403$/);
    });

    await then('the egress log holds a request to "tracker.example.invalid" refused by "allowlist"', async () => {
      expect(await box.egressLog(id)).toContainEqual(
        expect.objectContaining({ host: "tracker.example.invalid", outcome: "refused", refusedBy: "allowlist" }),
      );
    });
  } finally {
    await box.destroyAll();
  }
});
