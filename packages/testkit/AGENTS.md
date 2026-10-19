# AGENTS.md for `packages/testkit`

Adds rules for the testkit. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or another program may use the testkit:

- Library: the exports of `src/index.ts` (`scenario` and its context), used by system tests
- CLI: `testkit <command>` (`bin/testkit.ts`, see `README.md#commands`), run in a module folder

The testkit's own system tests use the CLI on small modules they write into the working folder.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner.

## Scenario prefix

`SCN-TK-NNN`
