// The sandbox's side of its egress proxy: the environment that sends every request through the proxy and trusts its
// CA. It holds placeholders and never a real secret.
import type { SandboxSpec } from "@opensoftware/contracts";
import { EGRESS_PROXY, placeholder } from "./egress-proxy.ts";

/** The sandbox's environment: the spec's variables, a placeholder per secret, the egress proxy and its CA. */
export function sandboxEnv(spec: SandboxSpec, egressUrl: string): Record<string, string> {
  const secrets = Object.keys(spec.secrets ?? {}).map((variable) => [variable, placeholder(variable)]);
  const proxy = ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"].map((name) => [name, egressUrl]);
  const ca = ["SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "GIT_SSL_CAINFO"].map(
    (name) => [name, EGRESS_PROXY.caFile],
  );
  return { ...spec.env, ...Object.fromEntries([...secrets, ...proxy, ...ca]) };
}
