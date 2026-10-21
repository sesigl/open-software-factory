# AGENTS.md for `packages/spec-files`

Adds rules for the spec-files library. The root `AGENTS.md` applies in full. Decisions: ADR 0039, ADR 0042.

## Public surface

The only way a system test or another program may use the library:

- Library: the exports of `src/index.ts` (`parseFeature`, `statusOf`, `tagValues`, `parseJUnit`, `readJUnitFolder`,
  `scenarioIdOf` and their types), imported as `@opensoftware/spec-files`

The library's system tests import it by its package name and call it in their own process (ADR 0039). Files go
through `sut.files`; `sut.files.path` gives their absolute path.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014). A file imports only its own layer and the layers below it.

| Layer | Paths | Holds |
| --- | --- | --- |
| api | `src/index.ts` | the public exports |
| readers | `src/gherkin.ts`, `src/junit.ts` | feature files with `@cucumber/gherkin`, JUnit XML with `fast-xml-parser` |

The library reads files into plain shapes. What a scenario or a result means for a check stays in the module or
the tooling that uses it.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 30 seconds in total on the CI runner.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-SPECFILES-NNN`
