---
status: accepted
date: 2026-11-03
---

# 0080. The factory implements this repository's issues on the owner's Claude subscription

## Context

Phase 3 starts when the factory implements this repository's `factory` issues with people at the gates
(`docs/explanation/bootstrapping.md`). intake already turns such an issue into a work item in the Compose profile on
the owner's machine, through a smee.io relay (ADR 0065). The foreman can run the claude-code harness through an
inference gateway with a key for each run (ADR 0056, ADR 0070), and every agent declares its model and effort level
(ADR 0078). Four things are missing:

- Claude Code on a subscription. The foreman gives Claude Code the run's key as `ANTHROPIC_API_KEY`, and with an API
  key Claude Code does not use the subscription.
- A gateway in the profile. The profile runs LiteLLM, but the litellm inference adapter always starts its own LiteLLM
  in Docker, and the foreman's container has no Docker.
- A gate that a person decides on the pull request. `gatekeeper serve`, which the foreman asks, decides only in Slack.
- The issue's location. A stage's prompt has the work item's title and description, not its origin, and a run's
  working folder is empty.

The owner's decisions: everything runs in the Compose profile on the owner's Mac; the owner approves on the pull
request; the agents push with a fine-grained GitHub token for this repository only. Models: Opus for spec and
implement, Sonnet for review, Haiku for triage and ship.

## Decision

- **Subscription through the gateway.** With `CLAUDE_CODE_OAUTH_TOKEN` (a token of `claude setup-token`) and a gateway
  key in `ANTHROPIC_API_KEY`, the claude-code adapter gives Claude Code the key as
  `ANTHROPIC_CUSTOM_HEADERS: x-litellm-api-key: Bearer <key>` and an empty `ANTHROPIC_API_KEY`. Claude Code then sends
  the token as `Authorization: Bearer`, and LiteLLM forwards it to its `anthropic/` models with Anthropic's OAuth
  header. The inference port names `x-litellm-api-key` as the second place a key goes, so every gateway adapter
  accepts it. Without the token the adapter changes nothing.
- **The litellm adapter attaches to a running proxy.** A config that names a proxy's URL and its master key's variable
  starts no container: `key`, `spend-log` and `stop` work on that proxy, and `stop` removes only the run keys it made.
  The profile's foreman uses the profile's `litellm`.
- **gatekeeper serve decides on pull requests.** A gate request with a link to a pull request is asked on that pull
  request, as the CLI's pull-request gate does, and decided from the approvers' `/approve` and `/reject` comments. A
  Slack channel becomes optional for the server.
- **The foreman says where the work is.** A stage's prompt names the work item's origin, and a gate request links
  the run's pull request.
- **A factory for this repository**, next to the reference factory: the same stages, with the gate on `implement`, so
  that the owner approves the spec's pull request before the code is written. The gate comes before its stage, so a
  gate on `spec` would ask before a spec exists. The prompts clone the origin's repository and follow `AGENTS.md`. Each
  run has a budget at LiteLLM's list prices, as a stop for a run that does not end.
- **Credentials.** The subscription token and the GitHub token are values of the owner's `.env` only: never in the
  repository, never in CI (ADR 0077). The foreman passes its environment to a harness that has no sandbox, so both
  tokens reach Claude Code; the GitHub token can write to this repository only, and branch protection keeps `main`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The subscription token straight to Anthropic, no gateway | No change | No spend log and no budget for each run; against the owner's rule that every model call goes through LiteLLM |
| An Anthropic API key in LiteLLM | LiteLLM's usual setup | A second bill next to the subscription the owner already pays |
| Gateway key in `x-litellm-api-key`, token in `Authorization` (chosen) | LiteLLM's documented way for Claude Code on a subscription; spend log and budget for each run | The header is LiteLLM's name; another gateway must accept it |
| `foreman serve` on the host with the existing adapter | No adapter change | Temporal, NATS and the foreman by hand; nobody else can repeat it |
| Approve in Slack | gatekeeper already does it | A Slack app and a public URL for its buttons; the spec is read on the pull request anyway |

## Prior art

- **LiteLLM** (MIT, BerriAI, active; pinned v1.106.2 in the profile): its tutorial "Claude Code with a Max
  subscription" forwards the client's OAuth `Authorization` header to `anthropic/` deployments and authenticates the
  proxy with `x-litellm-api-key`. Adopted as documented.
- **Claude Code** (Anthropic): `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` and `ANTHROPIC_CUSTOM_HEADERS` are
  its documented variables. Adopted; the adapter's system test runs the real Claude Code against the testkit's
  gateway and reads the headers.
- **GitHub fine-grained personal access tokens**: one repository, Contents and Pull requests write. Adopted for the
  agents' clone, push and pull requests; GitHub's `gh` CLI (MIT, active) opens the pull requests.

## Consequences

- Runs cost nothing beyond the owner's subscription, and LiteLLM still logs every call with `osf.run.id` and stops a
  run at its budget. The budget counts list prices, not the subscription's limits.
- The factory works only while the owner's machine runs the profile and the relay; a subscription is one person's,
  so this setup never runs in CI.
- A harness without a sandbox sees the foreman's environment, including both tokens. A sandbox for the dogfood is a
  later step.
- Revisit when the factory runs on a shared machine, when a second person approves, or when Anthropic or LiteLLM
  change how a subscription's token is sent.
