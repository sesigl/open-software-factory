---
status: accepted; SPECGUARD, CODEOWNERS and the path guard removed by 0013
date: 2026-10-19
---

# 0011. Dependencies of the repository tooling and checks

## Context

TODO item T-00 builds `make`, the checks of `docs/quality/checks.md` and CI. The checks must be deterministic,
print file and line, and read Gherkin, TypeScript, JUnit XML, JSON Schema and OpenAPI. ADR 0009 makes TypeScript
the only core language; ADR 0010 picks pnpm workspaces, Turborepo and `make`; `docs/architecture/stack.md` names
the quality tools.

## Decision

The tooling is the private package `@opensoftware/tools` in `tools/`, run directly by Node 24 (type stripping, no build).
It depends on:

| Need | Dependency | Version |
| --- | --- | --- |
| Parse feature files (SPEC, TRACE, STEPS, SPECGUARD, DOCS-GEN) | `@cucumber/gherkin`, `@cucumber/messages` | 42.0.1, 34.2.1 |
| Read TypeScript tests (TRACE, STEPS, NOSKIP, ASSERT, BOUNDARY-ENV) | `ts-morph` | 28.0.0 |
| Import rules (BOUNDARY-STATIC, ISOLATION) | `dependency-cruiser` | 18.6.0 |
| Read JUnit XML (PASS, FLAKE, BUDGET) | `fast-xml-parser` | 5.11.2 |
| Validate contract fixtures (CONTRACT) | `ajv` | 8.20.0 |
| Front matter and YAML (DOCS-AFFECTED, ADR) | `yaml` | 2.9.1 |
| Glob matching for `covers:` and CODEOWNERS | `picomatch` (and `@types/picomatch`) | 4.0.7 |
| Task graph and caching (ADR 0010) | `turbo` | 2.11.7 |
| Test runner and JUnit reporter | `vitest` | 4.1.12 |
| Format and lint | `@biomejs/biome` | 2.5.15 |
| Types | `typescript`, `@types/node` | 5.9.3, 24.19.2 |
| Links in Markdown (DOCS-LINKS) | `lychee` binary, checksum-pinned in `tools/scaffold/install-tools.ts` | 0.20.1 |
| Breaking OpenAPI changes (CONTRACT) | `oasdiff` binary, checksum-pinned in `tools/scaffold/install-tools.ts` | 1.11.7 |

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Adopt the parsers and linters above | maintained, standard, deterministic | about 150 transitive npm packages |
| Regular expressions over source files | no dependencies | misses aliases and multi-line calls; wrong line numbers |
| `typescript` compiler API instead of ts-morph | one dependency less | more code for the same AST walks |
| Write a link checker | no binary | lychee already handles anchors and offline mode |

## Prior art

- **Gherkin parsing:** `@cucumber/gherkin` is the official parser used by every Cucumber implementation (MIT,
  released monthly). The child-apps-company seed `scripts/lib/gherkin.ts` wraps it the same way.
- **Traceability:** checked Cucumber's own reports, `gherkin-lint` and Serenity BDD. None maps scenario IDs to
  outside-in tests by AST and JUnit; our own `spec-trace` module (T-06) will replace these scripts.
- **AST access:** ts-morph (MIT, active) wraps the TypeScript compiler API.
- **Import boundaries:** dependency-cruiser (MIT, active), as named in the stack.
- **JUnit XML:** fast-xml-parser (MIT, active); JUnit has no official schema, so we read the common subset that
  Vitest writes.
- **Links:** lychee (Apache-2.0/MIT, active) supports `--offline` and Markdown anchors.
- **OpenAPI diff:** oasdiff (Apache-2.0, active) is the de facto breaking-change checker.
- **Lint and format:** Biome (MIT), as in the stack. Turborepo (MIT), as in ADR 0010.

## Consequences

Contributors need Node 24 and pnpm. `make install` downloads lychee and oasdiff for Linux x86_64; on other
platforms they must be on `PATH`. The ADR check requires an accepted ADR that names every new dependency.
