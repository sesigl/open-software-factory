// The MCP Registry (API v0.1), read only by "factory plan" to pin a version (ADR 0020).

export interface RegistryServer {
  name: string;
  version: string;
  packages?: { registryType: string; identifier: string; version: string }[];
  remotes?: { type: string; url: string }[];
}

/** The base URL of the MCP Registry: FACTORY_MCP_REGISTRY, or the public registry. */
export function registryUrl(): string {
  return (process.env.FACTORY_MCP_REGISTRY ?? "https://registry.modelcontextprotocol.io").replace(/\/$/, "");
}

/** Every published version of a server. */
export async function versionsOf(name: string): Promise<RegistryServer[]> {
  const url = `${registryUrl()}/v0.1/servers/${encodeURIComponent(name)}/versions`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`the MCP Registry answered ${response.status} for ${url}`);
  const body = (await response.json()) as { servers: { server: RegistryServer }[] };
  return body.servers.map((entry) => entry.server);
}
