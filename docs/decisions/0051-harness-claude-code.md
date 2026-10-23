---
status: accepted
date: 2026-10-23
---

# 0051. The harness proxy becomes a library, Claude Code is the second adapter, and the scripted harness stays in the testkit

## Context

ADR 0050 made the harness port ACP on stdio and each harness adapter an ACP proxy. It built the generic adapter
`acp` and left three slices of T-12: a `scripted` adapter for deterministic smoke runs, the product adapters
`claude-code`, `codex` and `opencode`, and the move of the proxy into a library when a second adapter needs it.

Three facts shape the next step:

- The testkit's scripted agent already runs behind the `acp` adapter: every conformance test of `acp` does it. A
  separate `scripted` adapter would ship test code to production, or copy the scripted agent out of the testkit
  (DUP), or make the testkit depend on an adapter that depends on the testkit (a cycle Turbo refuses).
- Claude Code speaks ACP through `@agentclientprotocol/claude-agent-acp`. A probe ran version 0.94.0 against a
  scripted Anthropic Messages endpoint on 127.0.0.1: Claude Code wrote a file after an ACP permission request of
  kind `edit` in 1.5 seconds, ended a cancelled turn at once, took a prompt sent while a tool ran into the same
  turn, ended a refused response with `refusal`, and reported tokens in each `session/prompt` answer and the
  session's cost in `usage_update`. No real model and no network beyond 127.0.0.1 is needed.
- Two conformance scenarios cannot hold for a real product. SCN-HARNESS-006 needs a harness that ignores a cancel;
  Claude Code never does. SCN-HARNESS-007 expects the harness name `acp` in the run record.

## Decision

- **The scripted harness is the `acp` adapter with the testkit's scripted agent.** There is no `scripted` package.
  A deterministic run starts `harness-acp run -- <fakes.harness() command>`; the smoke suite (T-20) has the
  testkit. The TODO slice is done by this decision.
- **The proxy moves into the library `packages/harness-proxy`** (`@opensoftware/harness-proxy`, prefix
  `SCN-HPROXY`). It exports `serveProxy` (the proxy between a client and an agent process, on given streams or on
  stdio), `exportTranscript` (the run record and the transcript), and `allowlistOf`. An adapter gives the harness
  name, the agent command and environment, and a hook that changes `session/new` before the agent sees it. The
  library's tests run the proxy in their own process with `sut.acp.serve` (new in the testkit) and the scripted
  agent behind it. The behavior of SCN-HARNESS-006 moves there.
- **The run record carries the usage the agent reports.** The proxy records the `usage` of each `session/prompt`
  answer. The run record sums them into `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`,
  `gen_ai.usage.cache_read.input_tokens` and `gen_ai.usage.cache_write.input_tokens`, and takes `osf.cost.usd`
  from the last `usage_update` with a cost in `USD`. Claude Code reports both; so does any ACP agent that
  implements usage. No product session files are read.
- **The adapter `adapters/harness/claude-code`** (`@opensoftware/harness-claude-code`, optional, prefix
  `SCN-HCLAUDE`): `harness-claude-code run [--allow <kinds>]` starts the pinned `claude-agent-acp` behind the proxy.
  - **Permission mode.** Every session starts in Claude Code's mode `default`, which asks before each edit and
    command, with `allowDangerouslySkipPermissions` off. A `defaultMode` in the folder's `.claude/settings.json`
    does not change it, and the proxy passes no `session/set_mode`, so a client cannot switch the mode either.
    Allow rules in the folder's settings still run their tools without asking; that is the repository's choice.
  - **Settings.** `CLAUDE_CONFIG_DIR` is `OSF_DATA/claude`, so no user settings, logins or memory of the machine
    reach the session. `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is `1`, so Claude Code calls nothing but the
    model.
  - **Model gateway.** `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` pass through. The inference
    port (T-14) gives the URL of its Anthropic-compatible endpoint and a gateway key; the sandbox (T-13) replaces
    placeholders with real secrets at the egress proxy.
  - **Conformance** runs the real Claude Code against `fakes.modelGateway`, which now also answers the Anthropic
    Messages API with scripted text, tool calls, stop reasons and calls it never answers.
- **Conformance changes.** SCN-HARNESS-006 is deprecated (the proxy library keeps the behavior as SCN-HPROXY-005).
  SCN-HARNESS-014 replaces SCN-HARNESS-007 without the harness name; each adapter states its name and version in a
  scenario of its own, in `adapters/<port>/<adapter>/features/`, which SPEC and TRACE now read.
- **Next:** `codex` (`@agentclientprotocol/codex-acp`, OpenAI Responses API) and `opencode` (`opencode acp`,
  OpenAI-compatible chat) follow the same pattern, each with a scripted gateway in the testkit for its API.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Proxy library, product adapters with hooks, scripted harness stays in the testkit | One proxy; product rules sit in the adapter; no test code in production | A library with its own scenarios next to the port's |
| A `scripted` adapter package with its own copy of the scripted agent | Matches the TODO wording | A clone of the testkit (DUP) or a dependency cycle with the testkit |
| Product adapters as launchers that start `harness-acp` | No library | An adapter depends on another adapter; no hook into `session/new` for the permission mode |
| Read Claude Code's session files for tokens and cost | Works for older bridges | Private file format; ACP already reports both |

## Prior art

- `@agentclientprotocol/claude-agent-acp` 0.94.0 (Apache-2.0, ACP project, released weekly, active): adopted as
  the agent behind the `claude-code` adapter. It runs Claude Code through `@anthropic-ai/claude-agent-sdk` 0.3.303
  ("SEE LICENSE IN README.md": Anthropic's terms; its platform package carries the Claude Code binary), which it installs.
- `@agentclientprotocol/sdk` (Apache-2.0, ACP project, active): kept at 1.9.0 for the proxy; it speaks ACP v1 with
  the bridge, which uses 2.0.0. An upgrade is its own change.
- acpx (MIT, openclaw, alpha) and Zed's ACP client (GPL-3.0, active): clients, checked again; neither gives the
  rules between client and agent that the proxy adds.
- LiteLLM (MIT, BerriAI, active): its Anthropic-compatible `/v1/messages` is the production endpoint (T-14), not a
  test fake.
- `llm-mock-server` 1.1.0 (MIT, one maintainer, last release June 2026): a standalone Fastify server that mocks the
  OpenAI, Anthropic and Responses APIs from rule files. Checked, not adopted: the testkit needs its own script
  format, one call log for both APIs, and calls it never answers, in process. msw (MIT, active) mocks requests
  inside one process, not a server for a child process. The testkit's model gateway grows the Messages API, as it
  has chat completions.

## Consequences

- foreman runs Claude Code with the same client and rules as any ACP agent, and the run record gets tokens and
  cost without product-specific code.
- The `claude-code` adapter's install is large: the Claude Agent SDK brings the Claude Code binary (about 270 MB on linux-x64).
  It is an optional adapter.
- Claude Code's own messages, system prompt and request shape change with each bridge version. The conformance
  tests match prompts by text and tool calls by name, so a bridge upgrade is a normal pull request that runs them.
- A SMOKE-PAID run with the real Anthropic API is left to T-21, with the other paid runs.
- Revisit when ACP standardizes usage and cost, or when Claude Code drops the Agent SDK bridge for native ACP.
