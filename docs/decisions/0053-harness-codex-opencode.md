---
status: accepted
date: 2026-10-23
---

# 0053. Codex and opencode run behind the harness proxy through their ACP bridges

## Context

ADR 0052 moved the harness proxy into `packages/harness-proxy` and built the `claude-code` adapter on it. T-12 still
needs the optional adapters `codex` and `opencode`: each product's ACP bridge behind the proxy, a permission mode that
asks before edits and commands, the model gateway settings, and conformance against the real CLI with a scripted
gateway for its API.

Two probes ran on 2026-10-23 against a scripted gateway on 127.0.0.1, with no network beyond it:

- **Codex.** `@agentclientprotocol/codex-acp` 2.2.2 starts the Codex App Server of `@openai/codex` 0.160.1. It
  calls the OpenAI Responses API (`POST /v1/responses`, a stream of server-sent events) with the tools
  `exec_command` (a function) and `apply_patch` (a custom tool with a patch grammar). In its mode `read-only`
  (approval `on-request`, a read-only sandbox) a read ran without asking, `apply_patch` asked with an ACP permission
  request of kind `edit`, and a command that asks to leave the sandbox asked with kind `execute`. A turn took 0.4
  seconds. The token usage of each turn is in the `session/prompt` answer; there is no cost. Codex reads its
  model provider from `config.toml` in `CODEX_HOME`; a provider given only in `CODEX_CONFIG` does not pass its
  authentication check.
- **opencode.** `opencode-ai` 1.19.4 speaks ACP itself (`opencode acp`). It calls an OpenAI-compatible chat
  completions API (`POST /v1/chat/completions`, a stream) through the AI SDK provider
  `@ai-sdk/openai-compatible`, with the tools `read`, `edit`, `write`, `bash` and others. With the permissions
  `edit` and `bash` set to `ask` it asked before each edit (kind `edit`) and command (kind `execute`). A folder's
  `opencode.json` that allows both ran them without asking, unless `OPENCODE_DISABLE_PROJECT_CONFIG` is set. Each
  session also asks the model for a title with the prompt in it, unless the agent `title` is disabled. A turn took
  1 second after a start of 1.3 seconds. Usage is in the `session/prompt` answer; there is no cost.

## Decision

- **The adapter `adapters/harness/codex`** (`@opensoftware/harness-codex`, optional, prefix `SCN-HCODEX`):
  `harness-codex run [--allow <kinds>]` starts the pinned `codex-acp` behind the proxy.
  - **Permission mode.** `INITIAL_AGENT_MODE` is `read-only`: Codex asks before each edit and each command that
    leaves the read-only sandbox. The proxy passes no `session/set_mode` and no `session/set_config_option`, so a
    client cannot switch a session to `agent-full-access`.
  - **Settings.** `CODEX_HOME` is `OSF_DATA/codex`. On each `run` the adapter writes `config.toml` there with one
    model provider `osf` and nothing else, so the user's `~/.codex` never reaches the session.
  - **Model gateway.** The provider `osf` calls `OPENAI_BASE_URL` (default `https://api.openai.com/v1`) with the
    Responses API and the key in `OPENAI_API_KEY`; `OPENAI_MODEL` names the model.
- **The adapter `adapters/harness/opencode`** (`@opensoftware/harness-opencode`, optional, prefix
  `SCN-HOPENCODE`): `harness-opencode run [--allow <kinds>]` starts the pinned `opencode acp --pure` behind the proxy.
  - **Permission mode.** The adapter's configuration sets every permission to `ask` and `webfetch` to `deny`, and
    `OPENCODE_DISABLE_PROJECT_CONFIG` keeps a folder's `opencode.json` from asking less.
  - **Settings.** The configuration is in `OPENCODE_CONFIG_CONTENT`. `XDG_CONFIG_HOME`, `XDG_DATA_HOME`,
    `XDG_CACHE_HOME` and `XDG_STATE_HOME` are under `OSF_DATA/opencode`, so the user's settings, logins and
    sessions never reach the session. Auto update, the models.dev fetch, LSP downloads and the title call are off.
  - **Model gateway.** One provider `osf` with `@ai-sdk/openai-compatible` calls `OPENAI_BASE_URL` with
    `OPENAI_API_KEY` and the model `OPENAI_MODEL`.
- **The testkit's model gateway** grows the OpenAI Responses API (text, function calls, custom tool calls, usage,
  calls it never answers) and a streamed chat completions answer with tool calls. Both take the next unanswered
  matching entry of the script, as the Messages API does.
- **Conformance.** Both adapters run the port's twelve implemented `@conformance` scenarios against the real CLI and
  state their name and version in a scenario of their own (ADR 0052).
- **The SMOKE-PAID runs** of all three product adapters stay with T-21.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The products' ACP bridges behind the proxy | Same proxy, allowlist and run record as claude-code; ACP gives usage | Two pinned bridges that change often |
| `codex exec --json` and `opencode serve` with an own ACP translation | No bridge dependency | Rebuilds what the bridges do; no permission requests from `codex exec` |
| Codex modes `workspace-write` or `agent` | Fewer questions | Edits without asking; `agent` lets a model review approvals |
| Codex's provider in `CODEX_CONFIG` only | No file written | Fails Codex's authentication check (probe) |
| Coder's agentapi | Works for any terminal agent | Screen scraping; no tool kinds for the allowlist |

## Prior art

- `@agentclientprotocol/codex-acp` 2.2.2 (Apache-2.0, ACP project, several releases a week, active): adopted. It
  brings `@openai/codex` 0.160.1 (Apache-2.0, OpenAI, active), whose platform package carries the Codex binary.
- `opencode-ai` 1.19.4 (MIT, sst/anomaly, daily releases, active): adopted; its native `opencode acp` is the ACP
  agent. Its platform package carries the opencode binary.
- `@zed-industries/codex-acp` 0.16.0 (Apache-2.0): the earlier Rust bridge, superseded by the ACP project's package.
- Coder's agentapi (MIT, active): checked again as the fallback for terminal-only agents; not needed for these two.
- `llm-mock-server` 1.1.0 (MIT, one maintainer): checked again for the Responses API; not adopted for the reasons in
  ADR 0052. The testkit's model gateway grows the two APIs.

## Consequences

- foreman can run Codex and opencode with the same client, rules and run record as Claude Code.
- Both installs are large (Codex about 250 MB, opencode about 150 MB on linux-x64). They are optional adapters.
- Codex's read-only sandbox needs Linux Landlock or macOS Seatbelt; a host without them fails sandboxed commands.
  The sandbox port (T-13) runs the adapter in a container that has them.
- Neither product reports cost over ACP, so their run records have tokens and no `osf.cost.usd`. The inference
  port (T-14) has the spend log.
- Revisit when ACP standardizes permission modes, or when a bridge upgrade changes the tools the scripts name.
