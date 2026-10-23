---
status: accepted
date: 2026-10-23
---

# 0050. The harness port is ACP on stdio; each harness adapter is an ACP proxy that adds the factory's rules

## Context

TODO item T-12 asks for one way to run any coding agent headless: start, send, stream events, approve a tool,
cancel and export the transcript. The vision asks that an agent runs on the harness its definition declares
(SCN-FACTORY-OPEN-002), that an agent starts sub-agents only with declared permission and that the refusal shows in
the run trace (ORCH-002), and that a person can steer a running agent (ORCH-006) and take over a run (ORCH-007).

The Agent Client Protocol (ACP) already covers most of the interface: `session/new` starts a session in a working
folder, `session/prompt` sends a message, `session/update` streams the agent's messages and tool calls,
`session/request_permission` asks the client to approve a tool call, and `session/cancel` cancels the turn. Most
harnesses speak it or have an open-source bridge, and the testkit's scripted harness speaks it (ADR 0018). The ACP
Registry names harnesses by ID, and `factory plan` pins them in `factory.lock` (ADR 0022).

ACP leaves out what the factory needs beyond an editor: a tool allowlist that the agent cannot talk its way around,
a hard deadline for cancel, and a transcript in the run record shape. Modules may not import adapters (ISOLATION),
so foreman cannot call an adapter as a library.

## Decision

- **The port is ACP v1 on stdio.** A harness adapter is a program. Its client (foreman, a script, a test) starts it,
  speaks ACP to it as to any agent, and gets the factory's rules on top. The port's shared behavior is the
  `@conformance` scenarios in `ports/harness/features/` (prefix `SCN-HARNESS`). Every adapter passes them with
  `testkit conformance`.
- **Each adapter is an ACP proxy.** It starts the product's ACP agent as a child process and passes messages both
  ways. It adds:
  - **The allowlist.** `--allow <kinds>` names the ACP tool kinds (`read`, `edit`, `delete`, `move`, `search`,
    `execute`, `think`, `fetch`, `switch_mode`, `other`) the client may approve. A permission request for a tool
    call of any other kind is rejected by the adapter, and the client is never asked. Without `--allow`, every
    request goes to the client.
  - **Cancel within 5 seconds.** The adapter passes `session/cancel` on. When the agent has not ended the turn
    3 seconds later, the adapter stops the agent, ends the turn with `cancelled` and exits.
  - **The session record.** The adapter writes every prompt, update, permission decision and stop reason of a
    session as one JSON line to `OSF_DATA/sessions/<session ID>.jsonl`, together with the resource attributes of
    `OTEL_RESOURCE_ATTRIBUTES` and the agent's name and version at the start of the session.
  - **The transcript export.** `<adapter> transcript <session ID>` writes `$OUTPUT/run-record.json`, a valid
    `run-record` (contracts): the resource of the session, `gen_ai.conversation.id` the session ID, `osf.outcome`
    from the last stop reason (`end_turn` gives `succeeded`, `cancelled` gives `cancelled`, every other reason
    `failed`) and `osf.transcript.uri` the `file:` URL of `$OUTPUT/transcript.jsonl`, the session record.
- **The adapter offers the agent no client file system and no terminal.** It removes `fs` and `terminal` from the
  client capabilities it passes on, so the agent reads and writes the working folder itself. The harness runs in
  the sandbox with its working folder (T-13); the client is no editor with open buffers.
- **Steering is a prompt sent while a turn runs.** The adapter passes it on at once and does not queue it. Taking
  over (ORCH-007) is the same session continued by a person through the same client, or the transcript export.
- **Adapters:**
  - `adapters/harness/acp` (`@opensoftware/harness-acp`, core): any ACP agent, named after `--` on the command line,
    for example `harness-acp run --allow read,edit -- npx @agentclientprotocol/claude-agent-acp`. Its conformance
    tests run the testkit's scripted harness behind it.
  - `claude-code`, `codex`, `opencode` (optional) and `scripted` (core) follow in the next slices of T-12. They start
    the product's ACP bridge (`@agentclientprotocol/claude-agent-acp`, `@agentclientprotocol/codex-acp`,
    `opencode acp`) behind the same proxy and add what the product needs: its own permission mode, its session files
    for tokens and cost, and its model gateway settings. The proxy code they share moves into a library in
    `packages/` when the second adapter needs it (ADR 0039), so no adapter imports another.
- **testkit:** `sut.acp.connect(args, { env, approve })` starts the adapter's built `bin` as an ACP agent and gives
  the test a client with sessions, prompts and cancel. `fakes.harness` gains scripted tool calls that ask for
  permission, turns that wait for a steering prompt, turns that ignore cancel, and other stop reasons.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| ACP on stdio as the port, adapters as ACP proxies | One protocol that harnesses already speak; foreman needs one client; the rules sit in a process the agent cannot change | Each turn passes one more process; ACP gaps (transcript, deadlines) are filled by the adapter, not the protocol |
| A TypeScript interface that adapters implement as libraries | Typed calls, no extra process | Modules may not import adapters (ISOLATION); every language and harness needs a TypeScript wrapper |
| An HTTP API per adapter (like `opencode serve` or Coder's agentapi) | Language neutral, remote | A second protocol next to ACP; agentapi scrapes terminals; streaming and permission requests need their own design |
| Use acpx as the client and leave the rules to foreman | Ready-made headless ACP client | Alpha with changing interfaces; it is a client, not the place for rules the agent must not bypass |

## Prior art

- Agent Client Protocol and its TypeScript SDK `@agentclientprotocol/sdk` (Apache-2.0, maintained by the ACP
  project with Zed, active, 1.9.0): adopted, already used by the testkit (ADR 0018). The adapter is an `agent()` app
  to its client and a `client()` app to the agent.
- `@agentclientprotocol/claude-agent-acp` (Apache-2.0, ACP project, formerly `@zed-industries/claude-code-acp`,
  active): the ACP bridge for Claude Code over the Claude Agent SDK. To be adopted by the `claude-code` adapter.
- `@agentclientprotocol/codex-acp` (Apache-2.0, ACP project, formerly `@zed-industries/codex-acp`, a Rust binary
  with an npm launcher, active): to be adopted by the `codex` adapter.
- `opencode acp` (MIT, sst/opencode, active): OpenCode speaks ACP itself. To be adopted by the `opencode` adapter.
- acpx (MIT, openclaw, alpha): a headless ACP client CLI with named sessions and prompt queueing. Checked, not
  adopted: it is a client, while the port needs the rules between client and agent.
- Coder agentapi (MIT, active): an HTTP API over terminal agents by screen scraping. Kept as the fallback for
  agents without ACP, as `docs/architecture/internals.md` says.

## Consequences

- foreman drives every harness with one ACP client, and a person's tool allowlist holds whatever the agent tries.
- A community adapter is any program that passes `ports/harness/features/` with `testkit conformance`.
- The allowlist sees only tool calls the agent asks permission for. A product that runs tools without asking must be
  configured to ask; that is the product adapter's job (`claude-code` sets its permission mode, for example).
- Tool kinds are coarse: `execute` covers every shell command. Rules by tool name or command come with the product
  adapters, which know their tool names.
- Revisit when ACP v2 leaves draft, or when ACP gains a transcript or usage message of its own.
