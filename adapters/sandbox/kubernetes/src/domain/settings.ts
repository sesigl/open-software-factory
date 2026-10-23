// The adapter's configuration from its environment (src/config.schema.json).

export interface Settings {
  namespace: string;
  secretsDir: string;
  /** Hostnames the egress pod resolves to fixed IP addresses. */
  hostAliases: { ip: string; hostnames: string[] }[];
  snapshotSize: string;
  openbaoMount?: string;
}

export function settingsOf(env: Record<string, string | undefined>): Settings {
  return {
    namespace: env.OSF_SANDBOX_NAMESPACE || "default",
    secretsDir: env.OSF_SECRETS_DIR ?? "/run/secrets",
    hostAliases: hostAliases(env.OSF_SANDBOX_HOST_ALIASES ?? ""),
    snapshotSize: env.OSF_SANDBOX_SNAPSHOT_SIZE || "1Gi",
    openbaoMount: env.OSF_OPENBAO_MOUNT,
  };
}

/** "host.docker.internal=172.18.0.1,api.local=10.0.0.5" as Kubernetes hostAliases, one per IP address. */
function hostAliases(text: string): Settings["hostAliases"] {
  const byIp = new Map<string, string[]>();
  for (const pair of text.split(",").filter((part) => part.trim())) {
    const [hostname = "", ip = ""] = pair.split("=").map((part) => part.trim());
    byIp.set(ip, [...(byIp.get(ip) ?? []), hostname]);
  }
  return [...byIp].map(([ip, hostnames]) => ({ ip, hostnames }));
}
