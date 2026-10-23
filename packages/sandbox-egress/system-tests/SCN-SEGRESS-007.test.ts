import { sandboxEnv } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SEGRESS-007", async ({ given, when, then }) => {
  let spec = { template: "alpine" } as Parameters<typeof sandboxEnv>[0];
  await given(
    'a sandbox spec with the variable "CI" set to "true" and the secret "LINEAR_TOKEN" from "ref:file/linear-token"',
    async () => {
      // The spec's variables, not the adapter's environment.
      const variables = { CI: "true" };
      spec = { template: "alpine", env: variables, secrets: { LINEAR_TOKEN: "ref:file/linear-token" } };
    },
  );

  let env: Record<string, string> = {};
  await when('the adapter calls sandboxEnv with the spec and the proxy URL "http://egress:8080"', async () => {
    env = sandboxEnv(spec, "http://egress:8080");
  });

  await then('the environment has "CI" "true" and "LINEAR_TOKEN" "osf-secret-placeholder-LINEAR_TOKEN"', async () => {
    expect(env).toMatchObject({ CI: "true", LINEAR_TOKEN: "osf-secret-placeholder-LINEAR_TOKEN" });
  });

  await then('"HTTPS_PROXY" is "http://egress:8080" and "SSL_CERT_FILE" is "/etc/osf/egress-ca.crt"', async () => {
    const ca = "/etc/osf/egress-ca.crt";
    const proxy = "http://egress:8080";
    expect(env).toEqual({
      CI: "true",
      LINEAR_TOKEN: "osf-secret-placeholder-LINEAR_TOKEN",
      HTTP_PROXY: proxy,
      HTTPS_PROXY: proxy,
      http_proxy: proxy,
      https_proxy: proxy,
      SSL_CERT_FILE: ca,
      NODE_EXTRA_CA_CERTS: ca,
      REQUESTS_CA_BUNDLE: ca,
      CURL_CA_BUNDLE: ca,
      GIT_SSL_CAINFO: ca,
    });
  });
});
