// What every sandbox looks like from inside: its working folder, where it finds the egress proxy's CA, and the
// iron-proxy image and folders every sandbox adapter starts (ADR 0054, ADR 0055).

/** The working folder of every command in the sandbox. */
export const WORKSPACE = "/workspace";

/** Where the sandbox finds the CA of its egress proxy, which terminates TLS. */
export const CA_FILE = "/etc/osf/egress-ca.crt";

/** iron-proxy, pinned by digest (ADR 0054). */
export const EGRESS_IMAGE =
  "ironsh/iron-proxy:0.54.0@sha256:6d074be2de9188f88d08013788d5500fb4de8557f16c2e5b27af4d8d2cb1e3fb";

/** Where the proxy keeps its files: the config, its CA and the secrets from files, one file per variable. */
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

/** The port of the egress proxy for HTTP_PROXY and HTTPS_PROXY. */
export const EGRESS_PORT = 8080;

/** The value the sandbox holds in place of a secret; the egress proxy swaps it for the real one. */
export const placeholder = (variable: string): string => `osf-secret-placeholder-${variable}`;
