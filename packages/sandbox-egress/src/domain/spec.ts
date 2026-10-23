// The sandbox spec as every adapter applies it: memory in bytes and the sandbox's environment, which holds
// placeholders and never a real secret.
import type { SandboxSpec } from "@opensoftware/contracts";
import { CA_FILE, placeholder } from "./names.ts";

const UNITS: Record<string, number> = { "": 1, Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4 };

/** A Kubernetes quantity such as "256Mi" in bytes. */
export function memoryBytes(quantity: string): number {
  const [, amount, unit] = /^([0-9]+)(Ki|Mi|Gi|Ti)?$/.exec(quantity) ?? [];
  return Number(amount) * (UNITS[unit ?? ""] as number);
}

/** The sandbox's environment: the spec's variables, a placeholder per secret, the egress proxy and its CA. */
export function sandboxEnv(spec: SandboxSpec, egressUrl: string): Record<string, string> {
  const secrets = Object.keys(spec.secrets ?? {}).map((variable) => [variable, placeholder(variable)]);
  const proxy = ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"].map((name) => [name, egressUrl]);
  const ca = ["SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "GIT_SSL_CAINFO"].map(
    (name) => [name, CA_FILE],
  );
  return { ...spec.env, ...Object.fromEntries([...secrets, ...proxy, ...ca]) };
}
