// The iron-proxy configuration of one sandbox (ADR 0054): the hosts it may reach, the secrets to swap and the MCP
// tools it may call. JSON is YAML, so iron-proxy reads it as written.
import type { SandboxSpec } from "@opensoftware/contracts";
import { placeholder, type SecretFile } from "./spec.ts";

/** Where the proxy keeps its files: the config, its CA and the secrets, one file per variable. */
export const PROXY_DIR = "/osf";

/** The proxy's start script: it creates the CA, hands its certificate out in `out/osf/`, then runs iron-proxy. */
export const START_SCRIPT = `#!/bin/sh
set -e
mkdir -p ${PROXY_DIR}/out/osf
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=osf sandbox egress" \\
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign" \\
  -keyout ${PROXY_DIR}/ca.key -out ${PROXY_DIR}/ca.crt 2>/dev/null
cp ${PROXY_DIR}/ca.crt ${PROXY_DIR}/out/osf/egress-ca.crt
exec iron-proxy -config ${PROXY_DIR}/proxy.yaml
`;

/** The log line iron-proxy writes when the sandbox can use it. */
export const READY = "tunnel proxy starting";

export function proxyConfig(spec: SandboxSpec, secrets: SecretFile[]): unknown {
  const egress = spec.egress ?? [];
  const mcp = spec.mcp ?? [];
  const hosts = [...new Set([...egress, ...mcp.map((server) => new URL(server.url).hostname)])];
  const swaps = secrets.map(({ variable }) => ({
    source: { type: "file", path: `${PROXY_DIR}/secrets/${variable}` },
    proxy_value: placeholder(variable),
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
