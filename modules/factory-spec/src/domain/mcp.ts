// MCP server references in factory.yaml and their pins in factory.lock (ADR 0020).
// `<package>@<version>` is an npm package started with npx; `registry:<name>@<range>` is pinned in factory.lock.
import { fail } from "./errors.ts";

export interface LockEntry {
  name: string;
  version: string;
  package?: { registryType: "npm"; identifier: string; version: string };
  remote?: { type: string; url: string };
}

/** factory.lock: the exact version of every registry server, keyed by its reference in factory.yaml. */
export interface Lock {
  version: 1;
  mcp: Record<string, LockEntry>;
}

/** How a harness reaches one MCP server: a local command over stdio, or a remote URL. */
export interface McpServer {
  name: string;
  launch: { command: string; args: string[] } | { url: string };
  /** The transport of a remote server as the registry names it, for example "streamable-http" or "sse". */
  transport?: string;
}

export function parseReference(reference: string): { registry: boolean; name: string; range: string } {
  const registry = reference.startsWith("registry:");
  const bare = registry ? reference.slice("registry:".length) : reference;
  const at = bare.lastIndexOf("@");
  return { registry, name: bare.slice(0, at), range: bare.slice(at + 1) };
}

/** The key of a server in the harness files: the last segment of its name, for example "server-github". */
export function serverKey(name: string): string {
  return name.split("/").pop() as string;
}

export function locked(lock: Lock, reference: string): LockEntry {
  return lock.mcp[reference] ?? fail(`factory.lock has no entry for "${reference}": run "factory plan"`);
}

/** The reference with the exact version factory.lock pins; npm references stay as written. */
export function pinned(lock: Lock, reference: string): string {
  const { registry, name } = parseReference(reference);
  return registry ? `registry:${name}@${locked(lock, reference).version}` : reference;
}

export function servers(references: string[], lock: Lock): McpServer[] {
  return references.map((reference) => {
    const { registry, name } = parseReference(reference);
    const entry = registry ? locked(lock, reference) : undefined;
    const launch = entry?.remote
      ? { url: entry.remote.url }
      : {
          command: "npx",
          args: ["-y", entry?.package ? `${entry.package.identifier}@${entry.package.version}` : reference],
        };
    return { name: serverKey(name), launch, ...(entry?.remote ? { transport: entry.remote.type } : {}) };
  });
}
