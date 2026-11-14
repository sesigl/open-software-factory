import { proxyConfig, resolveSecrets, startScript } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { secretsDir, transform } from "./egress.ts";

scenario("SCN-SEGRESS-023", async ({ sut, given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof proxyConfig>[0];
  let dir = "";
  await given(
    'a sandbox spec with the egress allowlist "api.linear.app" and the secrets "LINEAR_TOKEN" from "ref:file/linear-token", "SLACK_TOKEN" from "ref:env/SLACK_TOKEN" and "GH_TOKEN" from "ref:openbao/forge-token"',
    async () => {
      spec = {
        template: "alpine",
        egress: ["api.linear.app"],
        secrets: {
          LINEAR_TOKEN: "ref:file/linear-token",
          SLACK_TOKEN: "ref:env/SLACK_TOKEN",
          GH_TOKEN: "ref:openbao/forge-token",
        },
      };
      dir = await secretsDir(sut, { "linear-token": "lin_real_7f3a" });
    },
  );

  let config: unknown;
  let script = "";
  await when("the adapter calls proxyConfig with the spec and its resolved secrets, and startScript", async () => {
    const env = {
      OSF_SECRET_SLACK_TOKEN: "xoxb_real_2e9b",
      OSF_OPENBAO_ADDR: "http://bao:8200",
      OSF_OPENBAO_TOKEN: "osf-test-bao-token",
    };
    config = proxyConfig(spec, resolveSecrets(spec, dir, env));
    script = startScript();
  });

  await then(
    'the configuration swaps each of the three placeholders by one rule in every header, on requests to "api.linear.app" only',
    async () => {
      const rule = { match_headers: [], rules: [{ host: "api.linear.app" }] };
      expect((transform(config, "secrets") as { secrets: unknown[] }).secrets).toEqual([
        {
          source: { type: "file", path: "/osf/secrets/LINEAR_TOKEN" },
          proxy_value: "osf-secret-placeholder-LINEAR_TOKEN",
          ...rule,
        },
        { source: { type: "env", var: "SLACK_TOKEN" }, proxy_value: "osf-secret-placeholder-SLACK_TOKEN", ...rule },
        {
          source: { type: "vault_kv", mount: "secret", path: "forge-token", json_key: "value" },
          proxy_value: "osf-secret-placeholder-GH_TOKEN",
          ...rule,
        },
      ]);
    },
  );

  await then("the start script writes no secret to a file", async () => {
    // It writes the proxy's CA and nothing of a secret: no Basic form, no read of a secret's file or variable.
    expect(script).toContain("exec iron-proxy -config /osf/proxy.yaml");
    expect(script).not.toMatch(/\/osf\/basic|\/osf\/secrets|base64/);
  });
});
