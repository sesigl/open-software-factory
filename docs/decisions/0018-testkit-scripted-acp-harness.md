---
status: accepted
date: 2026-10-19
---

# 0018. The testkit's scripted harness is an ACP agent built on the official SDK

## Context

Modules such as foreman drive coding agents through the harness port, and its generic adapter speaks the Agent
Client Protocol (ACP) (docs/architecture/internals.md). System tests must not call a real model. T-02 asks for a
scripted ACP harness that performs scripted file edits and reports completion over ACP, and for a
`conformance(port, adapter)` runner that community adapters can use as the conformance kit.

## Decision

- `fakes.harness(script)` gives the test a `command` and `args` that start a scripted agent on stdio. The agent is
  built on `@agentclientprotocol/sdk` 1.9.0 (its `agent()` app and `ndJsonStream`). For each `session/prompt` it
  takes the first unused turn whose `when` the prompt contains, writes the turn's files (through the client's
  `fs/write_text_file` when the client offers it, else in the session's working folder), streams the reply as an
  `agent_message_chunk` and ends the turn with `end_turn`.
- A prompt that matches no turn ends with `refusal` and fails the scenario with the prompt shown, like an
  unscripted model call.
- `testkit conformance <port features folder>` runs an adapter's system tests like `testkit run`, then prints one
  line per implemented `@conformance` scenario of the port (passed, failed, skipped, or no system test) and exits 1
  unless every one passed. In this repository the port features are `ports/<port>/features/`; a community adapter
  passes its copy of that folder.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Scripted agent on the official ACP SDK | The real protocol, validated by the SDK's schemas; follows ACP updates | One dependency (and its `zod` peer, already in the tree) |
| Hand-written JSON-RPC agent | No dependency | Drifts from the protocol; no schema validation |
| A real agent with a fake model (for example an ACP agent pointed at `fakes.modelGateway`) | Exercises a real agent | Slow, version-dependent, and edits depend on the agent's own prompting |
| Conformance as generated tests per scenario | No test files to write | TRACE needs one test file per scenario and adapter, with a literal ID |

## Prior art

- `@agentclientprotocol/sdk` (Apache-2.0, official TypeScript SDK of ACP, active, 1.x): adopted.
- Zed's ACP example agents and `agentapi` (MIT): examples of real agents, not scriptable.
- Pact and the Kubernetes conformance suites: show the idea of one shared scenario set run against many providers;
  their tooling does not fit Gherkin scenarios run through the testkit, so the runner is a small command.

## Consequences

- Harness adapters and modules that drive agents are tested without a model and in seconds.
- A community adapter can show conformance with one command; the catalog's "verified" mark can rely on its output.
- Revisit when ACP v2 leaves draft: the SDK already routes v1 and v2.
