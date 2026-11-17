---
name: new-module
description: Create a new module or adapter from the template. Use when a tool or adapter does not exist yet and an ADR approves it.
---

# Create a module

## Before you start

- An accepted ADR in `docs/decisions/` names the module, its tier (core, optional or community) and the prior art
  that was checked, and answers `## Why a package`. Without it, write it first: `skills/write-adr`, whose step 4
  holds the bar a new package must clear (ADR 0159).
- When the bar is not met, do not create a module: put the code into an existing library whose job it fits (`cli`,
  `testkit`, `contracts`, `factory-source`, `spec-files`), or keep it in the one unit that uses it. An adapter of a
  port is its own package, `@opensoftware/<port>-<name>`, whatever its size (ADR 0175).

## Steps

1. `make new-module NAME=<name>`. This copies the working module `modules/_template/` (ADR 0015), renames it and
   registers the module ID prefix in `docs/reference/scenario-prefixes.md`. The new module's quick-start test
   passes from the start; replace its `hello` command with the module's first real command.
2. Fill in `README.md`: the one problem the module solves alone, the quick start, inputs and outputs. Its first
   sentence and the `description` of `package.json` say the module's one job in one sentence (ADR 0135).
3. Fill in `AGENTS.md` for the module: public surface (every command, route, event and file, and for a library every
   value it exports: SURFACE), allowed exceptions (for example unit tests for a parser), and the budget of its
   system tests: the line `System tests: N seconds of wall time`, in a section of at most three lines (BUDGET,
   ADR 0155). Keep the "Quality limits" (duplication and mutation score) and the `mutation`
   script in `package.json` from the template; DUP and MUTATION fail without them (ADR 0037).
4. Pick the module's layers in `architecture.json` (ADR 0014). The template starts with `entry` → `adapters` →
   `domain`; change it when the module needs another shape. A file may import its own layer and the layers below
   it. The ARCH check enforces this.
5. Write the first scenario: the five-minute quick start from the README, with `skills/write-scenario`.
   Every module's `SCN-<MODULE>-001` is its quick start.
6. Continue with `skills/write-system-test` and `skills/implement-scenario`.

## Rules

- A module is useful alone. If it needs another module to be useful, it is part of that module.
- A package has one job and a narrow surface (ADR 0135). When its sentence needs "and" to join two jobs, or a library's
  list of values keeps growing, split it.
- The public surface is listed under "Public surface" in the module's `AGENTS.md` (SURFACE reads it), described in
  `README.md` and, for shared formats, in `contracts/`: CLI commands, HTTP endpoints, MCP tools, events, input and
  output folders. Everything else is private.
- An adapter implements one port and passes that port's `@conformance` scenarios.
- What the module's code loads at run time is in `dependencies` (or `peerDependencies`): npm does not install
  `devDependencies` with a published package. A file it needs from a library that is only a devDependency, like a
  picture of the design system, its build copies into `dist/`. DEPS-RUNTIME enforces this (ADR 0138).
