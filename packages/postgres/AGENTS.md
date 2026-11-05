# AGENTS.md for `packages/postgres`

Adds rules for the postgres library. The root `AGENTS.md` applies in full. Decisions: ADR 0039, ADR 0082.

## Public surface

The only way a system test or another program may use the library:

- Library: the exports of `src/index.ts` (`openPool`, `transaction` and the type `PoolOptions`), imported as
  `@opensoftware/postgres`

The library's system tests import it by its package name and call it in their own process (ADR 0039), on the
database of `fakes.postgres()`. A test may hold a transaction between two of its queries and stop that database.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014). A file imports only its own layer and the layers below it.

| Layer | Paths | Holds |
| --- | --- | --- |
| api | `src/index.ts` | the public exports |
| pool | `src/pool.ts` | `openPool` and `transaction` around `pg` |

Only code that two or more modules need around `pg` belongs here. Their tables and queries stay in the modules.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 30 seconds in total on the CI runner.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-PG-NNN`
