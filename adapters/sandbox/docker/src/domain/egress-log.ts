// The egress log: one line per request that left the sandbox, from iron-proxy's audit lines. It keeps the facts a
// person needs and leaves out header values and MCP arguments.

export interface EgressEntry {
  host: string;
  method: string;
  path: string;
  outcome: "allowed" | "refused";
  /** What refused the request: "allowlist", "mcp" or another iron-proxy transform. */
  refusedBy?: string;
  mcpServer?: string;
  tool?: string;
  /** The variables whose placeholders the proxy swapped for the real secret. */
  secrets?: string[];
}

interface Audit {
  msg?: string;
  audit?: { host?: string; method?: string; path?: string; action?: string };
  rejected_by?: string;
  request_transforms?: { name: string; annotations?: { swapped?: { secret: string }[] } }[];
  mcp?: { server?: string; messages?: { direction?: string; tool?: string; decision?: string }[] };
}

export function egressEntries(log: string): EgressEntry[] {
  return log.split("\n").flatMap((line) => {
    const record = parse(line);
    return record?.msg === "request" && record.audit ? [entry(record)] : [];
  });
}

function entry(record: Audit): EgressEntry {
  const { host = "", method = "", path = "", action } = record.audit ?? {};
  const call = record.mcp?.messages?.find((message) => message.direction === "request" && message.tool);
  const refusedBy = record.rejected_by ?? (call?.decision === "deny" ? "mcp" : undefined);
  const secrets = (record.request_transforms ?? [])
    .flatMap((transform) => transform.annotations?.swapped ?? [])
    .map((swap) => swap.secret.split("/").pop() as string);
  return {
    host: host.replace(/:\d+$/, ""),
    method,
    path,
    outcome: action === "allow" ? "allowed" : "refused",
    ...(refusedBy ? { refusedBy } : {}),
    ...(record.mcp?.server ? { mcpServer: record.mcp.server } : {}),
    ...(call?.tool ? { tool: call.tool } : {}),
    ...(secrets.length ? { secrets } : {}),
  };
}

function parse(line: string): Audit | undefined {
  try {
    return JSON.parse(line) as Audit;
  } catch {
    return undefined;
  }
}
