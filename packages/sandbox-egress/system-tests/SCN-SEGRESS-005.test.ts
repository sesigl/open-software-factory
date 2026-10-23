import { proxyConfig, proxyEnv, resolveSecrets } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { transform } from "./egress.ts";

scenario("SCN-SEGRESS-005", async ({ given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof proxyConfig>[0];
  await given(
    'a sandbox spec with the egress allowlist "api.linear.app" and the secret "LINEAR_TOKEN" from "ref:openbao/teams/linear-token"',
    async () => {
      spec = {
        template: "alpine",
        egress: ["api.linear.app"],
        secrets: { LINEAR_TOKEN: "ref:openbao/teams/linear-token" },
      };
    },
  );

  let env: Record<string, string> = {};
  await given(
    'the adapter\'s variables "OSF_OPENBAO_ADDR" "http://bao:8200" and "OSF_OPENBAO_TOKEN" "osf-test-bao-token"',
    async () => {
      env = { OSF_OPENBAO_ADDR: "http://bao:8200", OSF_OPENBAO_TOKEN: "osf-test-bao-token" };
    },
  );

  let config: unknown;
  let variables: Record<string, string> = {};
  await when("the adapter resolves the secrets and calls proxyConfig and proxyEnv", async () => {
    const secrets = resolveSecrets(spec, "/run/secrets", env);
    config = proxyConfig(spec, secrets);
    variables = proxyEnv(secrets, env);
  });

  await then(
    'the configuration swaps the placeholder for the field "value" of "teams/linear-token" in the KV mount "secret"',
    async () => {
      expect(transform(config, "secrets")?.secrets?.[0]).toMatchObject({
        source: { type: "vault_kv", mount: "secret", path: "teams/linear-token", json_key: "value" },
        proxy_value: "osf-secret-placeholder-LINEAR_TOKEN",
        rules: [{ host: "api.linear.app" }],
      });
    },
  );

  await then(
    'proxyEnv gives the proxy "VAULT_ADDR" "http://bao:8200" and "VAULT_TOKEN" "osf-test-bao-token"',
    async () => {
      expect(variables).toEqual({ VAULT_ADDR: "http://bao:8200", VAULT_TOKEN: "osf-test-bao-token" });
    },
  );
});
