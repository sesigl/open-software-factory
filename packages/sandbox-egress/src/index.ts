// @opensoftware/sandbox-egress: the egress proxy of a sandbox, for every sandbox adapter (ADR 0054, ADR 0055,
// ADR 0147).
export { type EgressEntry, egressEntries } from "./domain/egress-log.ts";
export { EGRESS_PROXY, startScript } from "./domain/egress-proxy.ts";
export { type ProxyOptions, proxyConfig } from "./domain/proxy-config.ts";
export { sandboxEnv } from "./domain/sandbox-env.ts";
export { proxyEnv, type Secret } from "./domain/secrets.ts";
export { resolveSecrets } from "./secret-files.ts";
