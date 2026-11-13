import { scenario } from "@opensoftware/testkit";
import { readmeWork, sandboxedFactory, serving } from "./foreman.ts";

const REFERENCE = "registry:io.github.acme/tickets@^1";
const URL = "https://mcp.acme.example/mcp";

scenario("SCN-FORE-143", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" whose agent "plan" declares the MCP server "registry:io.github.acme/tickets@^1", which "factory.lock" pins as the remote "https://mcp.acme.example/mcp", with a fake sandbox adapter as "docker"',
    async () => {
      const lock = {
        version: 1,
        mcp: {
          [REFERENCE]: {
            name: "io.github.acme/tickets",
            version: "1.2.0",
            remote: { type: "streamable-http", url: URL },
          },
        },
      };
      await sut.files.put("$INPUT/factory.lock", `${JSON.stringify(lock, null, 2)}\n`);
      const factory = sandboxedFactory(fakes).replace(
        "    prompt: ./agents/plan.md\n",
        '    prompt: ./agents/plan.md\n    mcp: ["registry:io.github.acme/tickets@^1"]\n',
      );
      server = await serving(sut, fakes, { factory, sandbox: {} });
    },
  );

  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
  });

  await then(
    'the sandbox adapter got for "plan" the egress hosts "registry.npmjs.org", "api.anthropic.com" and "mcp.acme.example", and for "implement" only the first two',
    async () => {
      const egress = server.sandbox?.created().map(({ spec }) => spec.egress);
      expect(egress).toEqual([
        ["registry.npmjs.org", "api.anthropic.com", "mcp.acme.example"],
        ["registry.npmjs.org", "api.anthropic.com"],
      ]);
    },
  );

  await then(
    'the harness opened the session of "plan" with the MCP server "tickets" at "https://mcp.acme.example/mcp" over HTTP',
    async () => {
      expect(server.harness.sessions()[0]?.mcpServers).toEqual([
        { type: "http", name: "tickets", url: URL, headers: [] },
      ]);
    },
  );
});
