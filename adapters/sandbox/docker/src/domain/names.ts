// What the parts of one sandbox are called on the Docker host, and how a sandbox ID looks.

/** The sandbox's ID: the first 12 hex digits of its container's ID, which Docker chose. */
export const ID = /^[0-9a-f]{12}$/;

/** The container of the sandbox, and the internal network it shares with its egress proxy only. */
export const sandboxName = (id: string): string => `osf-sandbox-${id}`;

/** The iron-proxy container of the sandbox. */
export const egressName = (id: string): string => `osf-sandbox-${id}-egress`;

/** The label on every sandbox container; `list` finds the sandboxes by it. */
export const ROLE_LABEL = "osf.sandbox.role=sandbox";

/** The name the sandbox reaches its egress proxy by, and the proxy's port for HTTP_PROXY and HTTPS_PROXY. */
export const EGRESS_URL = "http://egress:8080";

/** The working folder of every command in the sandbox. */
export const WORKSPACE = "/workspace";

/** Where the sandbox finds the CA of its egress proxy, which terminates TLS. */
export const CA_FILE = "/etc/osf/egress-ca.crt";

/** iron-proxy, pinned by digest (ADR 0054). */
export const EGRESS_IMAGE =
  "ironsh/iron-proxy:0.54.0@sha256:6d074be2de9188f88d08013788d5500fb4de8557f16c2e5b27af4d8d2cb1e3fb";
