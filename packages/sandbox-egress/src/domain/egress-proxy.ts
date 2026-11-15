// The egress proxy's container, as every sandbox adapter starts it: the pinned iron-proxy image, its folder, its port,
// the log line that says it is ready, and where the sandbox finds its CA (ADR 0054, ADR 0055, ADR 0147).

/** The iron-proxy container of a sandbox. */
export const EGRESS_PROXY = {
  /** iron-proxy, pinned by digest (ADR 0054). */
  image: "ironsh/iron-proxy:0.54.0@sha256:6d074be2de9188f88d08013788d5500fb4de8557f16c2e5b27af4d8d2cb1e3fb",
  /** Where the proxy keeps its files: the config, its CA and the secrets from files, one file per variable. */
  dir: "/osf",
  /** The port of the egress proxy for HTTP_PROXY and HTTPS_PROXY. */
  port: 8080,
  /** The log line iron-proxy writes when the sandbox can use it. */
  ready: "tunnel proxy starting",
  /** Where the sandbox finds the CA of its egress proxy, which terminates TLS. */
  caFile: "/etc/osf/egress-ca.crt",
} as const;

const { dir } = EGRESS_PROXY;

/**
 * The proxy's start script: it creates the CA, hands its certificate out in `out/osf/`, then runs iron-proxy. It
 * writes nothing of a secret: iron-proxy finds a placeholder in git's Basic credentials itself (ADR 0139).
 */
export function startScript(): string {
  return `#!/bin/sh
set -e
mkdir -p ${dir}/out/osf
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=osf sandbox egress" \\
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign" \\
  -keyout ${dir}/ca.key -out ${dir}/ca.crt 2>/dev/null
cp ${dir}/ca.crt ${dir}/out/osf/egress-ca.crt
exec iron-proxy -config ${dir}/proxy.yaml
`;
}

/** The value the sandbox holds in place of a secret; the egress proxy swaps it for the real one. */
export const placeholder = (variable: string): string => `osf-secret-placeholder-${variable}`;
