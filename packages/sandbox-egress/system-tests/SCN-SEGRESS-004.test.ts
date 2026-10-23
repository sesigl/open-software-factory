import { proxyConfig, proxyEnv, resolveSecrets } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { transform } from "./egress.ts";

scenario("SCN-SEGRESS-004", async ({ given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof proxyConfig>[0];
  await given(
    'a sandbox spec with the egress allowlist "api.linear.app" and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"',
    async () => {
      spec = { template: "alpine", egress: ["api.linear.app"], secrets: { LINEAR_TOKEN: "ref:env/LINEAR_TOKEN" } };
    },
  );

  let env: Record<string, string> = {};
  await given('the adapter\'s variable "OSF_SECRET_LINEAR_TOKEN" with the value "lin_env_51c2"', async () => {
    env = { OSF_SECRET_LINEAR_TOKEN: "lin_env_51c2" };
  });

  let config: unknown;
  let variables: Record<string, string> = {};
  await when("the adapter resolves the secrets and calls proxyConfig and proxyEnv", async () => {
    const secrets = resolveSecrets(spec, "/run/secrets", env);
    config = proxyConfig(spec, secrets);
    variables = proxyEnv(secrets, env);
  });

  await then('the configuration swaps the placeholder for the proxy\'s variable "LINEAR_TOKEN"', async () => {
    expect(transform(config, "secrets")?.secrets?.[0]).toMatchObject({
      source: { type: "env", var: "LINEAR_TOKEN" },
      proxy_value: "osf-secret-placeholder-LINEAR_TOKEN",
    });
  });

  await then('proxyEnv gives the proxy the variable "LINEAR_TOKEN" with the value "lin_env_51c2"', async () => {
    expect(variables).toEqual({ LINEAR_TOKEN: "lin_env_51c2" });
  });
});
