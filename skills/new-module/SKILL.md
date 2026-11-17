---
name: new-module
description: Create a new module or adapter from the template. Use when a tool or adapter does not exist yet and an ADR approves it.
---

# Create a module

## Before you start

- An accepted ADR in `docs/decisions/` names the module, its tier (core, optional or community) and the prior art
  that was checked, and answers `## Why a package` (ADR 0159). Without it, stop and use `skills/write-adr`.
- The package earns its place: a job of its own, a reason to be installed or released alone (a user installs it
  without the rest, or a factory names it as the adapter of a port in `factory.yaml`, or two units of different
  release cadence need it), a second user today for a library, and about 300 lines of source for a library. An
  adapter may be smaller; then prefer one package per port family with a command per product. When the bar is not
  met, put the code into an existing library whose job it fits (`cli`, `testkit`, `contracts`, `factory-source`,
  `spec-files`), or keep it in the one unit that uses it.

## Steps

1. `make new-module NAME=<name>`. This copies the working module `modules/_template/` (ADR 0015), renames it and
   registers the module ID prefix in `docs/reference/scenario-prefixes.md`. The new module's quick-start test
   passes from the start; replace its `hello` command with the module's first real command.
2. Fill in `README.md`: the one problem the module solves alone, the quick start, inputs and outputs. Its first
   sentence and the `description` of `package.json` say the module's one job in one sentence (ADR 0135).
3. Fill in `AGENTS.md` for the module: public surface (every command, route, event and file, and for a library every
   value it exports: SURFACE), allowed exceptions (for example unit tests for a parser), the wall time budget of its
   system tests (one line, ADR 0155). Keep the "Quality limits" (duplication and mutation score) and the `mutation`
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
- The public surface is declared in `README.md` and `contracts/`: CLI commands, HTTP endpoints, MCP tools,
  events, input and output folders. Everything else is private.
- An adapter implements one port and passes that port's `@conformance` scenarios.
- What the module's code loads at run time is in `dependencies` (or `peerDependencies`): npm does not install
  `devDependencies` with a published package. A file it needs from a library that is only a devDependency, like a
  picture of the design system, its build copies into `dist/`. DEPS-RUNTIME enforces this (ADR 0138).
