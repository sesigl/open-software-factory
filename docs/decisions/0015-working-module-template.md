---
status: accepted
date: 2026-10-19
---

# 0015. The module template is a working module

## Context

`make new-module` copies `modules/_template`. Until now the template held placeholders such as `<name>` and
`<PREFIX>`, stayed outside the pnpm workspace and was skipped by every check. Nobody could run its quick-start
test, so a new module started with a test that had never passed, and the template could break without anyone
noticing. T-02 is done when the template's quick-start test runs green through the testkit.

## Decision

- `modules/_template` is a real, private workspace package, `@opensoftware/module-template`, with the CLI
  `module-template hello <name>`, its layers `entry` → `adapters` → `domain` (ADR 0014) and the implemented
  quick-start scenario `SCN-TEMPLATE-001`. The prefix `TEMPLATE` is registered like any other.
- `make verify` builds it, runs its system test and runs every check on it, like on any module.
- `make new-module NAME=x` copies it without `node_modules/` and `dist/` and renames `modules/_template`,
  `module-template` and `SCN-TEMPLATE-` to the new module's names. A new module starts green: its quick start
  passes until its author replaces the `hello` command.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Working template in the workspace | Checked on every change; new modules start green | The template has a toy command that each new module replaces |
| Placeholder template, instantiated in a test | Template files stay generic | The test needs a build toolchain in a temp folder; slow and fragile |
| A separate example module | A realistic example | A module with no purpose, and the template still untested |

## Prior art

- Nx generators and Turborepo's `turbo gen` (MIT, active): generate from templates with placeholders; they need
  their own tooling, which ADR 0010 keeps out.
- plop and hygen (MIT; plop active, hygen rarely released): placeholder templates rendered by a generator; the
  rendered result is not tested.
- `create-*` starters such as create-vite (MIT, active): ship a template that builds and runs as is. This ADR
  follows that idea for `modules/_template`.

## Consequences

- A change that breaks new modules, such as a testkit change, now fails `make verify` on the template.
- The template's names (`module-template`, `SCN-TEMPLATE-`, `modules/_template`) must not appear in a sense that
  should survive the copy.
- Revisit when modules need more than one template, for example a server template.
