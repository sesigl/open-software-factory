import { proxyConfig } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { transform } from "./egress.ts";

scenario("SCN-SEGRESS-001", async ({ given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof proxyConfig>[0];
  await given(
    'a sandbox spec with the egress allowlist "api.linear.app" and the MCP server "wiki" at "https://wiki.example.com/mcp"',
    async () => {
      spec = {
        template: "alpine",
        egress: ["api.linear.app"],
        mcp: [{ name: "wiki", url: "https://wiki.example.com/mcp", tools: ["search"] }],
      };
    },
  );

  let config: unknown;
  await when("the adapter calls proxyConfig with the spec", async () => {
    config = proxyConfig(spec, []);
  });

  await then('the allowlist of the configuration is "api.linear.app" and "wiki.example.com"', async () => {
    expect(transform(config, "allowlist")).toEqual({ domains: ["api.linear.app", "wiki.example.com"] });
  });
});
