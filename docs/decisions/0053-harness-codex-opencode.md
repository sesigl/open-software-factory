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
  authentication check. A second `session/prompt` while a turn runs steers the turn, but the first prompt never
  gets its answer; codex-acp's own request `_session/steering` steers it and both end. Codex ends a turn only with
  `end_turn` or `cancelled`, never with `refusal`, and a refused tool call ends the turn with `cancelled`. A
  folder's `.codex/config.toml` may change the model, not the model provider. Codex also syncs a plugin repository
  from GitHub and sends analytics unless its configuration turns both off.
- **opencode.** `opencode-ai` 1.19.4 speaks ACP itself (`opencode acp`). It calls an OpenAI-compatible chat
  completions API (`POST /v1/chat/completions`, a stream) through the AI SDK provider
  `@ai-sdk/openai-compatible`, with the tools `read`, `edit`, `write`, `bash` and others. With the permissions
  `edit` and `bash` set to `ask` it asked before each edit (kind `edit`) and command (kind `execute`). A folder's
  `opencode.json` that allows both ran them without asking, unless `OPENCODE_DISABLE_PROJECT_CONFIG` is set. Each
  session also asks the model for a title with the prompt in it, unless the agent `title` is disabled. A turn took
  1 second after a start of 1.3 seconds. Usage is in the `session/prompt` answer; there is no cost. A model answer
  with the finish reason `content_filter` ends the turn with `refusal`. A folder's `.opencode/opencode.json` is read
  even with `OPENCODE_DISABLE_PROJECT_CONFIG`, and its agent permissions win over the global ones. A few seconds
  after the start opencode installs `@opencode-ai/plugin` from the npm registry into its config folder.

## Decision

- **The adapter `adapters/harness/codex`** (`@opensoftware/harness-codex`, optional, prefix `SCN-HCODEX`):
  `harness-codex run [--allow <kinds>]` starts the pinned `codex-acp` behind the proxy.
  - **Permission mode.** `INITIAL_AGENT_MODE` is `read-only`: Codex asks before each edit and each command that
    leaves the read-only sandbox. The proxy passes no `session/set_mode` and no `session/set_config_option`, so a
    client cannot switch a session to `agent-full-access`.
  - **Settings.** `CODEX_HOME` is `OSF_DATA/codex`. On each `run` the adapter writes `config.toml` there with one
    model provider `osf`, no analytics, no web search, no update check, and the features off that call another
    service (plugins, apps, browsers, computer use, image generation, updates). The user's `~/.codex` never
    reaches the session.
  - **Model gateway.** The provider `osf` calls `OPENAI_BASE_URL` (default `https://api.openai.com/v1`) with the
    Responses API and the key in `OPENAI_API_KEY`. `OPENAI_MODEL` goes into `CODEX_CONFIG`, the session's own
    settings, so it wins over a folder's `.codex/config.toml`.
  - **Steering.** The proxy library gets the option `steering`: the request an agent takes a steering message as.
    With it, a prompt sent while a turn runs goes to the agent as that request, and its answer is the running
    turn's answer. The codex adapter names `_session/steering`; the testkit's scripted harness takes it too.
- **The adapter `adapters/harness/opencode`** (`@opensoftware/harness-opencode`, optional, prefix
  `SCN-HOPENCODE`): `harness-opencode run [--allow <kinds>]` starts the pinned `opencode acp --pure` behind the proxy.
  - **Permission mode.** The adapter's configuration lets reading, searching and the todo list run, sets every
    other permission to `ask` and web fetch and web search to `deny`, for the top level and for each built-in agent
    (`build`, `plan`, `general`, `explore`), with `default_agent` `build`. `OPENCODE_CONFIG_CONTENT` is read last,
    so these win over a folder's `.opencode/opencode.json`, and `OPENCODE_DISABLE_PROJECT_CONFIG` skips its
    `opencode.json`.
  - **Settings.** The configuration is in `OPENCODE_CONFIG_CONTENT`. `XDG_CONFIG_HOME`, `XDG_DATA_HOME`,
    `XDG_CACHE_HOME` and `XDG_STATE_HOME` are under `OSF_DATA/opencode`, so the user's settings, logins and
    sessions never reach the session. Auto update, the models.dev fetch, LSP downloads, Claude Code's settings and
    skills, external plugins (`--pure`), sharing and the title call are off. npm runs offline with a cache of its
    own, so the plugin install calls no registry.
  - **Binary.** `opencode-ai` installs its binary in a postinstall script, which pnpm does not run. The adapter
    runs the binary of the platform package `opencode-<platform>-<arch>` that `opencode-ai` depends on.
  - **Model gateway.** One provider `osf` with `@ai-sdk/openai-compatible` calls `OPENAI_BASE_URL` with
    `OPENAI_API_KEY` and the model `OPENAI_MODEL`, which `run` requires.
- **The testkit's model gateway** grows the OpenAI Responses API (text, function calls, custom tool calls, usage,
  calls it never answers) and a streamed chat completions answer with tool calls. Both take the next unanswered
  matching entry of the script, as the Messages API does.
- **Conformance.** Both adapters run the port's implemented `@conformance` scenarios against the real CLI and state
  their name and version in a scenario of their own (ADR 0052). Each product names its tool calls itself
  (`Edit files` for Codex, the file's path for opencode); the tests match a tool call by its kind and file.
- **SCN-HARNESS-009 is deprecated.** A turn that the harness ends with `refusal` cannot happen with Codex. The proxy
  library keeps the behavior (SCN-HPROXY-009); claude-code (SCN-HCLAUDE-005) and opencode (SCN-HOPENCODE-005) keep
  it with the real product.
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
- Codex's read-only sandbox needs a Linux sandbox (bubblewrap or Landlock) or macOS Seatbelt. A host without one, such
  as a GitHub runner that forbids unprivileged user namespaces, fails every sandboxed command, so the folder stays
  intact but commands that only read fail too. The sandbox port (T-13) runs the adapter in a container that has one.
- Neither product reports cost over ACP, so their run records have tokens and no `osf.cost.usd`. The inference
  port (T-14) has the spend log.
- A Codex session whose tool call the client or the allowlist refused ends with `cancelled`, so its run record has
  the outcome `cancelled`. A failed model call ends a Codex turn with `end_turn`; the run record shows it as
  `succeeded`. Revisit with codex-acp's session failure extension.
- A folder can still bring opencode commands and agents in `.opencode/`; a call of such an agent goes through the
  `task` tool, which asks.
- Revisit when ACP standardizes permission modes, or when a bridge upgrade changes the tools the scripts name.
