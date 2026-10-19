# AGENTS.md for `packages/testkit`

Adds rules for the testkit. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or another program may use the testkit:

- Library: the exports of `src/index.ts` (`scenario` and its context), used by system tests
- CLI: `testkit <command>` (`bin/testkit.ts`, see `README.md#commands`), run in a module folder

The testkit's own system tests use the CLI on small modules they write into `$INPUT`.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014). A file imports only its own layer and the layers below it.

| Layer | Paths | Holds |
| --- | --- | --- |
| cli | `bin/` | `testkit run` |
| api | `src/index.ts` | the public exports |
| scenario | `src/scenario.ts` | `scenario(id, fn)`, the steps and the context |
| sut | `src/sut/` | the handle on the module under test |
| fakes | `src/fakes/` | the systems a test controls instead of real ones |
| support | `src/support/` | reading a module's files, running processes |

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 240 seconds in total on the CI runner.

## Scenario prefix

`SCN-TK-NNN`
