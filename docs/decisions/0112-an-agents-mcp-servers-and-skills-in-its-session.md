---
status: accepted
date: 2026-11-13
---

# 0112. An agent's MCP servers and skills in its session

## Context

T-44: the foreman opened each ACP session with `mcpServers: []` and gave the agent only its prompt, so the `mcp` and
`skills` of an agent in `factory.yaml` did nothing in a run. `factory render` (ADR 0020) writes the same two fields as
files of each harness (`.mcp.json`, `.codex/config.toml`, `opencode.json` and skill links), for a person's checkout.
The foreman may not import factory-spec, a module with a `bin` (ISOLATION, ADR 0037). A run must keep what its factory
version declared (ADR 0110), and a sandboxed agent reaches only the hosts of its egress (ADR 0068).

## Decision

- When the foreman reads the factory, it resolves each MCP reference of an agent into ACP's `McpServer` shape:
  `<package>@<version>` is `npx -y <package>@<version>` over stdio; `registry:<name>@<range>` is its pin in
  `factory.lock` as `factory plan` writes it, a package run with `npx` or a remote URL over HTTP. The server's name is
  the last segment of its name, as `factory render` names it. A registry reference without a pin is an error.
- It reads the files of each skill folder as text at the same time. Both go into the stage's plan, in the workflow's
  history, like the prompt's text: a run and its replay use what the factory version declared.
- `session/new` gets the agent's MCP servers. ACP is how a client gives an agent its MCP servers, so no harness file
  is written for them, and the same session works for every harness adapter and in a sandbox.
- Before the turn, the foreman writes each skill into the session's folder below `.claude/skills/<name>` (Claude Code)
  and `.agents/skills/<name>` (Codex, OpenCode), replacing a folder of that name. It writes copies, not links: the
  folder is copied into a sandbox, where a link to the factory's folder leads nowhere.
- A sandboxed agent's egress also allows the host of each remote MCP server. A server that runs with `npx` needs the
  npm registry in the agent's own `egress`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Resolve in the foreman, servers through ACP, skills copied (chosen) | No new dependency; one shape for every harness; works in a sandbox | About 20 lines repeat what factory-spec knows of references and `factory.lock` |
| Run `factory render` as a program into the session's folder | One renderer | A second program at run time; harness files the ACP session already covers; skill links break in a sandbox |
| Move factory-spec's resolver into a library in `packages/` | No repeated knowledge | A new package and release for 20 lines; its output is a harness file, not ACP's shape |

## Prior art

ACP's `session/new` carries `mcpServers` (stdio, HTTP, SSE) for this purpose; Zed and the ACP adapters of Claude Code
and Codex take them. The skill folders follow what Claude Code (`.claude/skills`) and Codex and OpenCode
(`.agents/skills`) read. Nothing new is adopted.

## Consequences

- An agent's MCP servers and skills take effect in each run, on the host and in a sandbox.
- A skill of an earlier stage stays in the run's folder; a later stage's skill of the same name replaces it.
- Skills are read as UTF-8 text; a binary file of a skill folder does not survive.
- `factory.lock` and the files of a skill folder that Git does not track do not stop a run yet, as an untracked prompt
  does (ADR 0110). Revisit when that check reads folders.
- Secrets of an HTTP MCP server's headers are not passed: a server that needs a key reaches it through the sandbox's
  egress proxy (ADR 0068).
