# AGENTS.md for `packages/cli`

Adds rules for the cli library. The root `AGENTS.md` applies in full. Decisions: ADR 0039, ADR 0040.

## Public surface

The only way a system test or another program may use the library:

- Library: the exports of `src/index.ts` (`runProgram`, `UsageError`, `check`, `readInputs`, `writeText`,
  `outputPath`, `packageVersion`), imported as `@opensoftware/cli`

The library's system tests import it by its package name and call it in their own process (ADR 0039). Files go
through `sut.files`; `sut.files.path` gives their absolute path.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014). A file imports only its own layer and the layers below it.

| Layer | Paths | Holds |
| --- | --- | --- |
| api | `src/index.ts` | the public exports |
| program | `src/program.ts` | `runProgram`: help, the command, its output and the exit code |
| files | `src/files.ts` | the input files, the output folder, the package version |
| errors | `src/errors.ts` | `UsageError` and `check` |

Only code that two or more modules need belongs here. Code of one module stays in that module.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 30 seconds in total on the CI runner.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-CLI-NNN`
