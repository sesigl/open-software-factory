---
status: accepted
date: 2026-10-18
---

# 0001. Record durable decisions as ADRs

## Context
Agents and people work on this repository over a long time. Reasons get lost unless they are written down.

## Decision
Every durable decision is an ADR in `docs/decisions/`, from `_template.md`. Every new module, dependency or
service needs an ADR with a filled **Prior art** section. ADRs are not edited after acceptance; a new ADR
supersedes an old one.

## Consequences
The ADR check fails a pull request that adds a module, dependency or service without an accepted ADR.
