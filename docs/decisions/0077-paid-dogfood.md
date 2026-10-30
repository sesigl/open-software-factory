---
status: accepted
date: 2026-10-30
---

# 0077. Paid dogfood: models, services and budget of T-21

## Context

TODO item T-21 holds every slice that needs a paid model call or a paid service. `AGENTS.md` says to stop and
ask before a paid call, and T-21 says to ask the owner before each slice which model or service it uses and its
budget. This ADR collects the open choices of all six slices, so the owner can answer them in one place.

The slices and what each needs:

| Slice | From | Needs |
| --- | --- | --- |
| scorekit | T-07 | A judge model that scores `runs/` nightly. |
| taskcapture | T-09 | Real models for `taskcapture-suite.yml` next to the oracle. |
| observer | T-10 | A model for `observer propose`, nightly, on the scorekit report. |
| harness | T-12, T-20 | One `SMOKE-PAID` run each for claude-code, codex and opencode (`make smoke-paid`). |
| intake | T-16 | A public URL for `intake serve`, as the target of this repository's `issues` webhook. |
| foreman | T-17 | `foreman serve` with a real harness and model next to the public intake. |

The workflow `nightly.yml` already has the job `smoke-paid` in the environment `smoke-paid`, with the secrets
`ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.

## Decision

The owner chose:

1. **The harness slice comes first, with claude-code and opencode.** `e2e/paid/harness.paid.ts` starts each of
   them with a real model and asks it to fix one typo. `make smoke-paid` runs it; the job `smoke-paid` of
   `nightly.yml` runs opencode every night. It is no system test: it has no scenario, no fakes and no network guard,
   so `make verify` never runs it and no check counts it.
2. **One small model through OpenRouter, 20 USD a month.** The owner has an OpenRouter key and no API keys of
   Anthropic or OpenAI. opencode calls OpenRouter's chat completions API with that one key, which allows only the
   model `deepseek/deepseek-v4.1-flash-1017`. The hard limit is the key's credit limit, set by the owner. The run
   also fails when the run record reports a cost above 0.20 USD, about a third of the nightly share of the budget.
3. **claude-code runs only on a developer's machine,** on that person's Claude subscription through a token of
   `claude setup-token`, with the small model `claude-haiku-5-5`. It never runs in CI: a subscription belongs to one person, and OpenRouter promises Claude
   Code only with Anthropic's models, which the key does not allow.
4. **codex has no paid run for now.** With that model Codex warned that it has no metadata for it, offered no edit
   tool, and the model tried a shell command, which the allowlist refused. The owner uses claude-code and opencode;
   codex can get a paid run later, with a model Codex knows or Codex's model catalog from OpenRouter.
5. **scorekit scores `runs/` every night** with the same key and model: the workflow `scores.yml` runs every
   scorer of the pack with `scorekit score --model`, which replaces the scorer's gateway alias `judge` with the
   OpenRouter model. The scores of earlier nights stay in the Actions cache, so a night pays only for new runs. The
   report is the job summary and the artifact `scorekit-report`; the README links the workflow. The run records in
   `runs/` carry no prompt content, so the judge sees the tool calls only.
6. **Where intake and foreman run** stays open, with the other slices. Each of them asks the owner again before
   its first paid call.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Harness slice first | Job and secrets exist; no hosting; proves the three adapters. | Needs keys for two providers. |
| scorekit, then observer | Gives the factory its first real feedback loop. | Two nightly paid jobs. |
| intake and foreman on a small VM | One process each, like the Compose profile. | A paid host to run and secure. |
| intake and foreman on a container platform | No host to manage. | A new paid service and its account. |
| Defer intake and foreman | No hosting cost now. | Phase 3 waits. |

## Prior art

The harness slice adds no new dependency or service: it drives the adapters with the ACP client
`@agentclientprotocol/sdk` that the testkit uses (ADR 0050). OpenRouter is the one paid service of the nightly run: one key and
one credit limit. The providers' own keys were the other option; the owner has none, and two keys would need two
spend limits. Each later slice that
picks a paid service records its prior art in its own pull request.

## Consequences

Each night spends at most about 0.20 USD when opencode reports its cost. A provider's change of model names or prices
can make the run fail; the model is set in `nightly.yml` only. The codex adapter has no real-model proof until it
gets its own paid run. The other slices wait for the owner's answers; each comes in its own pull
request with its scenarios and its budget. Revisit when a provider's price or the nightly cost changes.
