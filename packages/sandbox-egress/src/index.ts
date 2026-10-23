// @opensoftware/sandbox-egress: what every sandbox adapter shares about the egress proxy (ADR 0054, ADR 0055).
export { type EgressEntry, egressEntries } from "./domain/egress-log.ts";
export {
  CA_FILE,
  EGRESS_IMAGE,
  EGRESS_PORT,
  PROXY_DIR,
  placeholder,
  READY,
  START_SCRIPT,
  WORKSPACE,
} from "./domain/names.ts";
export { type ProxyOptions, proxyConfig } from "./domain/proxy-config.ts";
export { envVariable, proxyEnv, type Secret } from "./domain/secrets.ts";
export { memoryBytes, sandboxEnv } from "./domain/spec.ts";
export { readSpec, resolveSecrets } from "./spec-file.ts";
