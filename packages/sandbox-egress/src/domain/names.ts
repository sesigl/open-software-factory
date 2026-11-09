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

/** The user name in git's Basic credentials for a token, as gh's credential helper sends it to GitHub. */
export const GIT_USER = "x-access-token";

/** Where the proxy writes each secret in git's Basic form, `base64(<GIT_USER>:<secret>)`; a folder it may write. */
export const BASIC_DIR = `${PROXY_DIR}/basic`;

/** A secret as the start script needs it: its variable, and the name of the proxy's variable for `env`. */
export interface ScriptSecret {
  variable: string;
  provider: string;
  name?: string;
}

/** The file below BASIC_DIR with a secret's Basic form: named after the proxy's variable for `env`. */
export const basicFile = (secret: ScriptSecret): string =>
  `${BASIC_DIR}/${secret.provider === "env" ? secret.name : secret.variable}`;

/**
 * The proxy's start script: it writes each secret from a file or a variable in git's Basic form (ADR 0096), creates
 * the CA, hands its certificate out in `out/osf/`, then runs iron-proxy. A secret from OpenBao has no Basic form.
 */
export function startScript(secrets: ScriptSecret[] = []): string {
  const basic = secrets.flatMap((secret) => {
    if (secret.provider !== "file" && secret.provider !== "env") return [];
    const value = secret.provider === "file" ? `"$(cat ${PROXY_DIR}/secrets/${secret.variable})"` : `"$${secret.name}"`;
    return [`printf '%s:%s' ${GIT_USER} ${value} | base64 | tr -d '\\n' > ${basicFile(secret)}\n`];
  });
  return `#!/bin/sh
set -e
mkdir -p ${PROXY_DIR}/out/osf ${BASIC_DIR}
${basic.join("")}openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=osf sandbox egress" \\
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign" \\
  -keyout ${PROXY_DIR}/ca.key -out ${PROXY_DIR}/ca.crt 2>/dev/null
cp ${PROXY_DIR}/ca.crt ${PROXY_DIR}/out/osf/egress-ca.crt
exec iron-proxy -config ${PROXY_DIR}/proxy.yaml
`;
}

/** The log line iron-proxy writes when the sandbox can use it. */
export const READY = "tunnel proxy starting";

/** The port of the egress proxy for HTTP_PROXY and HTTPS_PROXY. */
export const EGRESS_PORT = 8080;

/** The value the sandbox holds in place of a secret; the egress proxy swaps it for the real one. */
export const placeholder = (variable: string): string => `osf-secret-placeholder-${variable}`;

/** The placeholder in git's Basic form, as git sends it when the sandbox's credential is the placeholder. */
export const basicPlaceholder = (variable: string): string =>
  Buffer.from(`${GIT_USER}:${placeholder(variable)}`).toString("base64");
