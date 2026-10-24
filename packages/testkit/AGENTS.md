# AGENTS.md for `packages/testkit`

Adds rules for the testkit. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or another program may use the testkit:

- Library: the exports of `src/index.ts` (`scenario` and its context), used by system tests
- Library: `@opensoftware/testkit/readme` (`src/support/readme.ts`: `documentedEnv`, `readmeSection`), used by
  the checks that read a module's README without running a test (ADR 0042)
- CLI: `testkit <command>` (`bin/testkit.ts`, see `README.md#commands`), run in a module folder

The testkit's own system tests use the CLI on small modules they write into `$INPUT`, and call
`@opensoftware/testkit/readme` directly.

The testkit depends on no library in `packages/`: every library is tested with the testkit, so such a dependency
would be a cycle.

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

- System tests: 400 seconds in total on the CI runner. Most scenarios run `testkit run` on a demo module, which
  starts a nested vitest: about 2.5 seconds each, of which recording coverage for REACH is 0.3. With 79 scenarios
  the total passed 240 seconds on main. SCN-TK-080 to -082 each start a Forgejo and take about 20 seconds.

## Quality limits

Checked by DUP (ADR 0037):

- Duplication: at most 3% of the source lines.

## Scenario prefix

`SCN-TK-NNN`
