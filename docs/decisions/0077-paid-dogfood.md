---
status: proposed
date: 2026-10-27
---

# 0077. Paid dogfood: models, services and budget of T-21

## Context

TODO item T-21 holds every slice that needs a paid model call or a paid service. `AGENTS.md` says to stop and
ask before a paid call, and T-21 says to ask the owner before each slice which model or service it uses and its
budget. This ADR collects the open choices of all six slices, so the owner can answer them in one place. It stays
`proposed` until the owner picks; the pull request of a slice then sets it to `accepted` with the choice.

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

Open. The owner answers three questions:

1. **Which slice comes first.** The proposal is the harness slice: its job and secrets exist, and it needs no
   hosting.
2. **Which model each slice uses, and the monthly budget.** The proposal is one small model for every nightly job
   (judge, observer, taskcapture), and each harness's own default model for `SMOKE-PAID`, with a hard spend limit
   on the provider's key.
3. **Where intake and foreman run.** They need a public URL and a running process; the options are below.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Harness slice first | Job and secrets exist; no hosting; proves the three adapters. | Needs keys for two providers. |
| scorekit, then observer | Gives the factory its first real feedback loop. | Two nightly paid jobs. |
| intake and foreman on a small VM | One process each, like the Compose profile. | A paid host to run and secure. |
| intake and foreman on a container platform | No host to manage. | A new paid service and its account. |
| Defer intake and foreman | No hosting cost now. | Phase 3 waits. |

## Prior art

No new module, dependency or service is chosen yet. Each slice that picks a paid service records its prior art in
the pull request that sets this ADR to `accepted`.

## Consequences

T-21 waits for the owner's answers. Each slice comes in its own pull request with its scenarios and the chosen
budget. Revisit when a provider's price or the nightly cost changes.
