import { proxyConfig } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import type { Config } from "./egress.ts";

scenario("SCN-SEGRESS-006", async ({ given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof proxyConfig>[0];
  await given(
    'a sandbox spec with the MCP server "wiki" at "https://wiki.example.com/mcp" and the tool "search"',
    async () => {
      spec = { template: "alpine", mcp: [{ name: "wiki", url: "https://wiki.example.com/mcp", tools: ["search"] }] };
    },
  );

  let config: unknown;
  await when("the adapter calls proxyConfig with the spec", async () => {
    config = proxyConfig(spec, []);
  });

  await then(
    'the MCP policy of the configuration allows the server "wiki" at "wiki.example.com" the tool "search" only',
    async () => {
      expect((config as Config).mcp).toEqual({
        servers: [
          {
            name: "wiki",
            rules: [{ host: "wiki.example.com", paths: ["/mcp", "/mcp/*"] }],
            tools: [{ name: "search" }],
          },
        ],
      });
    },
  );
});
