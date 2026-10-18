---
status: accepted
date: 2026-10-18
---

# 0007. Outside-in system tests, no unit tests by default

## Context
Agents write most of the code. Unit tests pin implementation details and cost agents many turns on every
refactor, while giving little proof that a behavior works.

## Decision
Every behavior is a Gherkin scenario at the root of its module. Every implemented scenario has exactly one system
test that drives the built module from outside. Deterministic checks (`docs/quality/checks.md`) prove each test
exists, follows its scenario, passes and stays outside the module. Unit tests are allowed only where a module's
`AGENTS.md` names a pure algorithm.

## Consequences
The testkit, its fakes and the checks are core infrastructure (TODO T-00 to T-02). System tests must stay fast;
each module has a time budget.
