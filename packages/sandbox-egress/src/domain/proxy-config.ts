// The iron-proxy configuration of one sandbox (ADR 0054, ADR 0055): the hosts it may reach, the secrets to swap
// and where each comes from, and the MCP tools it may call. JSON is YAML, so iron-proxy reads it as written.
import type { SandboxSpec } from "@opensoftware/contracts";
import { PROXY_DIR, placeholder } from "./names.ts";
import type { Secret } from "./secrets.ts";

export interface ProxyOptions {
  /** The KV mount of `ref:openbao/...` secrets, OSF_OPENBAO_MOUNT. Default: "secret". */
  openbaoMount?: string;
}

export function proxyConfig(spec: SandboxSpec, secrets: Secret[], options: ProxyOptions = {}): unknown {
  const egress = spec.egress ?? [];
  const mcp = spec.mcp ?? [];
  const hosts = [...new Set([...egress, ...mcp.map((server) => new URL(server.url).hostname)])];
  const swaps = secrets.map((secret) => ({
    source: source(secret, options.openbaoMount ?? "secret"),
    proxy_value: placeholder(secret.variable),
    match_headers: [],
    rules: egress.map((host) => ({ host })),
  }));
  return {
    dns: { listen: "127.0.0.1:5353", proxy_ip: "127.0.0.1" },
    proxy: { http_listen: ":8081", https_listen: ":8443", tunnel_listen: ":8080" },
    tls: { ca_cert: `${PROXY_DIR}/ca.crt`, ca_key: `${PROXY_DIR}/ca.key` },
    transforms: [
      { name: "allowlist", config: { domains: hosts } },
      // A secret is swapped only for the hosts of egress; without any, it goes nowhere.
      ...(egress.length && swaps.length ? [{ name: "secrets", config: { secrets: swaps } }] : []),
    ],
    ...(mcp.length
      ? {
          mcp: {
            servers: mcp.map((server) => {
              const url = new URL(server.url);
              return {
                name: server.name,
                rules: [{ host: url.hostname, paths: [url.pathname, `${url.pathname.replace(/\/$/, "")}/*`] }],
                tools: server.tools.map((name) => ({ name })),
              };
            }),
          },
        }
      : {}),
    log: { level: "info" },
  };
}

/** Where iron-proxy reads the secret: a file of the proxy, a variable of the proxy, or OpenBao's KV engine. */
function source(secret: Secret, mount: string): Record<string, string> {
  if (secret.provider === "file") return { type: "file", path: `${PROXY_DIR}/secrets/${secret.variable}` };
  if (secret.provider === "env") return { type: "env", var: secret.name };
  return { type: "vault_kv", mount, path: secret.path, json_key: "value" };
}
