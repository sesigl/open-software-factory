// What a stage's agent gets besides its prompt (ADR 0112): its MCP servers, in the shape ACP's `session/new` takes, and
// its skills, as the files the foreman writes into the session's folder.

import type { McpServer } from "@agentclientprotocol/sdk";

/** An MCP server as ACP's `session/new` takes it: a program over stdio, or a URL over streamable HTTP. */
export type SessionMcpServer = McpServer;

/** The pin of a registry server in factory.lock, as `factory plan` writes it (ADR 0020). */
export interface LockPin {
  package?: { identifier: string; version: string };
  remote?: { url: string };
}

/** One skill: its folder's name and its files by path below that folder. */
export interface Skill {
  name: string;
  files: Record<string, string>;
}

/** The folders of the session's folder that hold the skills: Claude Code's, and the one Codex and OpenCode read. */
export const SKILL_FOLDERS = [".claude/skills", ".agents/skills"];

/**
 * The server of an MCP reference of `factory.yaml`: `registry:<name>@<range>` as factory.lock pins it, a package or a
 * remote, and `<package>@<version>` as npx runs it. Its name is the last segment of the server's name.
 */
export function sessionServer(reference: string, pins: Record<string, LockPin>): SessionMcpServer {
  const registry = reference.startsWith("registry:") ? reference.slice("registry:".length) : undefined;
  const name = (registry ?? reference)
    .slice(0, (registry ?? reference).lastIndexOf("@"))
    .split("/")
    .pop() as string;
  if (registry === undefined) return { name, command: "npx", args: ["-y", reference], env: [] };
  const pin = pins[reference];
  if (!pin) throw new Error(`factory.lock has no entry for "${reference}": run "factory plan"`);
  if (pin.remote) return { type: "http", name, url: pin.remote.url, headers: [] };
  const spec = pin.package ? `${pin.package.identifier}@${pin.package.version}` : registry;
  return { name, command: "npx", args: ["-y", spec], env: [] };
}

/** The hosts of the servers that the agent reaches over HTTP, which its sandbox's egress must allow. */
export const hostsOf = (servers: SessionMcpServer[]): string[] =>
  servers.flatMap((server) => ("url" in server ? [new URL(server.url).hostname] : []));
