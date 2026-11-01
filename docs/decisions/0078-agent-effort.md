---
status: accepted
date: 2026-11-01
---

# 0078. Every agent declares its effort level

## Context

An agent in `factory.yaml` names its `harness`, its `model` and its `prompt`. The model alone does not tell how much
the model thinks before it answers. Claude Code, Codex and opencode each have an effort level for that, and each sets it
in its own way. A factory that does not set it gets the harness's default, which can change with a new release of the
harness, and which nobody sees in the factory's file.

The owner's rule for the levels: a smart model (Opus, Sonnet) works at a low or medium level by default, because it is
strong enough; only an agent for hard work gets `high` or more. A small model (Haiku) works at `high` or more.

The harness adapters take their settings as variables (ADR 0050, ADR 0052, ADR 0053), and the foreman hands each
stage's agent the gateway's URL, the run's key and the agent's model as variables (ADR 0070).

## Decision

- **A required field.** Every agent of the factory definition has `effort`, one of `low`, `medium`, `high`, `xhigh`
  and `max`. It is required, so that every factory shows the level of each agent in its file. A newly required field is
  a breaking change: the contracts package gets a new major version.
- **One variable of the harness port, `OSF_EFFORT`.** The foreman sets it to the agent's `effort` for each stage, in
  the harness's environment and in a sandbox's environment, with or without an inference gateway. Each adapter maps it
  to its product's own setting:

  | Adapter | Product setting | On the wire |
  | --- | --- | --- |
  | claude-code | `CLAUDE_CODE_EFFORT_LEVEL`, which wins over every other effort setting of Claude Code | the effort of the Messages API request |
  | codex | `model_reasoning_effort` in the session's settings | `reasoning.effort` of the Responses API request |
  | opencode | `reasoningEffort` in the options of the gateway's model | `reasoning_effort` of the chat completions request |
  | acp | none: the generic adapter passes its environment to its agent unchanged | the agent's own |

- **The levels are in the factory, not in code.** A model can be a routing alias of the gateway, like
  `routes/implement`, so no code can tell its family. The factory-spec README states the rule, and the reference
  factory sets each agent's level by it.
- **No lint warning for a high level.** `factory lint` reports problems, not advice, and an alias hides the model
  family. A level that does not fit the rule is a question for the review of the factory's pull request.
- **Through the inference gateway.** LiteLLM forwards the effort of each of the three APIs to the provider, and it
  forwards a Claude subscription's token (since v1.81.14). So the effort works the same for a run on a subscription.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Required `effort` (chosen) | The level of every agent is visible and reviewed | A breaking change; every factory file must add it |
| Optional `effort` | No breaking change | A factory without it gets a default that nobody sees and that a harness release can change |
| Defaults by model family in code | Less to write | A routing alias hides the family; a rule in code is not visible in the factory |
| The foreman sets each product's variable | No change in the adapters | The foreman must know every product; a community adapter could not take part |

## Prior art

No new module, dependency or service. The product settings that the adapters use: Claude Code's
`CLAUDE_CODE_EFFORT_LEVEL` and `effortLevel`; Codex's `model_reasoning_effort`; opencode's `reasoningEffort` model
option; LiteLLM's forwarding of `output_config.effort`, `reasoning.effort` and `reasoning_effort`.

## Consequences

- Every `factory.yaml` must add `effort` to each agent before it uses contracts 2.0.0; `factory lint` names each agent
  without it. Tools released on contracts 1.x reject `effort` as an unknown field, so a factory adds it together with
  the tools' new versions. The reference factory of the Compose profile and the Helm chart, which pin released images,
  gets its levels when the profile moves to those versions.
- A new harness adapter maps `OSF_EFFORT` to its product, or documents that its product has no effort level.
- `render --k8s` and the gh-aw files do not carry the effort yet; revisit when a kagent ModelConfig or gh-aw needs it.
