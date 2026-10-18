---
status: accepted
date: 2026-10-18
---

# 0004. Temporal as the foreman's workflow engine

## Context
The delivery loop waits hours or days for people, needs signals (approvals, steering), timers, child workflows
and a visible history.

## Decision
Temporal (MIT), TypeScript SDK. Stage logic stays in plain functions so a DBOS backend remains possible for the
single-VM profile.

## Options considered
| Option | For | Against |
| --- | --- | --- |
| Temporal | built for long waits; history UI; polyglot workers | a server to operate |
| DBOS | library on Postgres; no extra service | younger |
| Hatchet, Inngest, Restate | good developer experience | licenses not checked |
| LangGraph | agent graphs | orchestrates model calls, not a delivery process with people and CI |

## Consequences
Contributors learn Temporal's determinism rules for workflow code.
