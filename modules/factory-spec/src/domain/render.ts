// The files each harness reads, as text, from one agent (ADR 0020). The model is not written: the inference
// gateway routes it at run time.
import { fail } from "./errors.ts";
import type { McpServer } from "./mcp.ts";

export interface Harness {
  /** The harness's skill folder, relative to the output folder. */
  skills: string;
  files(servers: McpServer[]): Record<string, string>;
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const each = <T>(servers: McpServer[], map: (server: McpServer) => T): Record<string, T> =>
  Object.fromEntries(servers.map((server) => [server.name, map(server)]));

export const HARNESSES: Record<string, Harness> = {
  "claude-code": {
    skills: ".claude/skills",
    files: (servers) => ({
      "CLAUDE.md": "@AGENTS.md\n",
      ".mcp.json": json({
        mcpServers: each(servers, ({ launch }) => ("url" in launch ? { type: "http", ...launch } : launch)),
      }),
    }),
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
