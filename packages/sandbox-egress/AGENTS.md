# AGENTS.md for `packages/sandbox-egress`

Adds rules for the sandbox-egress library. The root `AGENTS.md` applies in full. Decisions: ADR 0054, ADR 0055.

## Public surface

The only way a system test or another program may use the library:

- Library: the exports of `src/index.ts` (see `README.md#api`), imported as `@opensoftware/sandbox-egress`

The library's system tests import it by its package name and call it in their own process (ADR 0039). Files go
through `sut.files`; `sut.files.path` gives their absolute path.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014). A file imports only its own layer and the layers below it.

| Layer | Paths | Holds |
| --- | --- | --- |
| api | `src/index.ts` | the public exports |
| adapters | `src/spec-file.ts` | reading the spec and checking that a secret's file exists |
| domain | `src/domain/` | secret references, iron-proxy's configuration and variables, the sandbox's environment, the egress log; no I/O |

Only code that two or more sandbox adapters need belongs here. What one platform needs stays in its adapter.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 20 seconds in total on the CI runner. They call functions; nothing starts.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-SEGRESS-NNN`
