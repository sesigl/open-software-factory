// The files each harness reads, as text, from one agent (ADR 0020). The model is not written: the inference
// gateway routes it at run time.
import { fail } from "./errors.ts";
import type { McpServer } from "./mcp.ts";

export interface Harness {
  /** The harness's skill folder, relative to the output folder. */
  skills: string;
  files(servers: McpServer[]): Record<string, string>;
  /**
   * The file the harness reads an agent's stop check from (ADR 0168), and that file's text with the check written into
   * its text as it is, or into a new file; none for a harness that runs no stop check.
   */
  stopCheck?: { path: string; write(existing: string | undefined, command: string): string };
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const each = <T>(servers: McpServer[], map: (server: McpServer) => T): Record<string, T> =>
  Object.fromEntries(servers.map((server) => [server.name, map(server)]));

/**
 * Claude Code's Stop hook for a stop check: Claude Code passes the hook's input as JSON on stdin, and code 2 blocks
 * the stop and hands the error output to the agent. The hook lets the agent stop when a Stop hook already blocked
 * this stop ("stop_hook_active") and when the turn left the repository's files as they were.
 */
const stopHook = (command: string): string =>
  [
    `grep -Eq '"stop_hook_active": *true' && exit 0`,
    `[ -z "$(git status --porcelain)" ] && exit 0`,
    `{ ${command}; } >&2 || { echo 'the stop check failed: fix it before you report done, or stop and ask' >&2; exit 2; }`,
  ].join("; ");

export const HARNESSES: Record<string, Harness> = {
  "claude-code": {
    skills: ".claude/skills",
    files: (servers) => ({
      "CLAUDE.md": "@AGENTS.md\n",
      ".mcp.json": json({
        mcpServers: each(servers, ({ launch }) => ("url" in launch ? { type: "http", ...launch } : launch)),
      }),
    }),
    // The Stop hook takes the place of every Stop hook of the file; its other keys and hooks stay.
    stopCheck: {
      path: ".claude/settings.json",
      write(existing, command) {
        const settings = JSON.parse(existing ?? "{}") as { hooks?: Record<string, unknown> };
        const stop = [{ hooks: [{ type: "command", command: stopHook(command) }] }];
        return json({ ...settings, hooks: { ...settings.hooks, Stop: stop } });
      },
    },
  },
  codex: {
    skills: ".agents/skills",
    files: (servers) => ({
      ".codex/config.toml": [
        '# Written by "factory render" from factory.yaml. Do not edit.',
        ...servers.flatMap(({ name, launch }) => [
          "",
          `[mcp_servers.${JSON.stringify(name)}]`,
          ...Object.entries(launch).map(([key, value]) => `${key} = ${JSON.stringify(value)}`),
        ]),
        "",
      ].join("\n"),
    }),
  },
  opencode: {
    skills: ".opencode/skills",
    files: (servers) => ({
      "opencode.json": json({
        $schema: "https://opencode.ai/config.json",
        mcp: each(servers, ({ launch }) =>
          "url" in launch
            ? { type: "remote", url: launch.url, enabled: true }
            : { type: "local", command: [launch.command, ...launch.args], enabled: true },
        ),
      }),
    }),
  },
};

export function harness(name: string): Harness {
  return (
    HARNESSES[name] ??
    fail(`factory render cannot write files for the harness "${name}"; it writes ${Object.keys(HARNESSES).join(", ")}`)
  );
}
