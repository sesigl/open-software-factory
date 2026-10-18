---
name: new-module
description: Create a new module or adapter from the template. Use when a tool or adapter does not exist yet and an ADR approves it.
---

# Create a module

## Before you start

- An accepted ADR in `docs/decisions/` names the module, its tier (core, optional or community) and the prior art
  that was checked. Without it, stop and use `skills/write-adr`.

## Steps

1. `make new-module NAME=<name> LANG=ts|py`. This copies `modules/_template/` and registers the module ID
   prefix in `docs/reference/scenario-prefixes.md`.
2. Fill in `README.md`: the one problem the module solves alone, the quick start, inputs and outputs.
3. Fill in `AGENTS.md` for the module: public surface, allowed exceptions (for example unit tests for a parser),
   time budget for its system tests.
4. Write the first scenario: the five-minute quick start from the README, with `skills/write-scenario`.
   Every module's `SCN-<MODULE>-001` is its quick start.
5. Continue with `skills/write-system-test` and `skills/implement-scenario`.

## Rules

- A module is useful alone. If it needs another module to be useful, it is part of that module.
- The public surface is declared in `README.md` and `contracts/`: CLI commands, HTTP endpoints, MCP tools,
  events, input and output folders. Everything else is private.
- An adapter implements one port and passes that port's `@conformance` scenarios.
